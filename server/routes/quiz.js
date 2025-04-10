const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// 全てのクイズを取得
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const quizzes = db.prepare('SELECT id, question, options, question_image_path, is_image_options FROM quiz').all();
    
    // 選択肢をJSON文字列から配列に変換
    const formattedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      options: JSON.parse(quiz.options)
    }));
    
    res.json(formattedQuizzes);
  } catch (error) {
    console.error('クイズの取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 特定のクイズを取得（解答なし）
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const quiz = db.prepare(`
      SELECT id, question, options, question_image_path, is_image_options
      FROM quiz 
      WHERE id = ?
    `).get(id);
    
    if (!quiz) {
      return res.status(404).json({ error: 'クイズが見つかりません' });
    }
    
    // 選択肢をJSON文字列から配列に変換
    quiz.options = JSON.parse(quiz.options);
    
    res.json(quiz);
  } catch (error) {
    console.error('クイズの取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズセッションの開始
router.post('/start/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    // クイズの存在を確認
    const quiz = db.prepare('SELECT id FROM quiz WHERE id = ?').get(id);
    if (!quiz) {
      return res.status(404).json({ error: 'クイズが見つかりません' });
    }
    
    // 進行中のセッションを終了
    db.prepare(`
      UPDATE quiz_session 
      SET ended_at = CURRENT_TIMESTAMP 
      WHERE quiz_id = ? AND ended_at IS NULL
    `).run(id);
    
    // 新しいセッションを開始
    const result = db.prepare(`
      INSERT INTO quiz_session (quiz_id) 
      VALUES (?)
    `).run(id);
    
    const sessionId = result.lastInsertRowid;
    
    res.json({ 
      success: true, 
      sessionId,
      message: `クイズ ${id} のセッションが開始されました` 
    });
  } catch (error) {
    console.error('クイズセッションの開始中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズの回答状況を取得
router.get('/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    // 最新のセッションを取得
    const session = db.prepare(`
      SELECT id FROM quiz_session 
      WHERE quiz_id = ? 
      ORDER BY started_at DESC 
      LIMIT 1
    `).get(id);
    
    if (!session) {
      return res.json({ 
        quizId: parseInt(id),
        totalParticipants: 0,
        correctAnswers: 0,
        stats: []
      });
    }
    
    // クイズの正解を取得
    const quiz = db.prepare('SELECT correct_answer, options FROM quiz WHERE id = ?').get(id);
    const options = JSON.parse(quiz.options);
    
    // 各選択肢ごとの回答数を集計
    const stats = options.map(option => {
      const count = db.prepare(`
        SELECT COUNT(*) as count 
        FROM answer 
        WHERE quiz_id = ? AND answer = ?
      `).get(id, option);
      
      return {
        option,
        count: count.count,
        isCorrect: option === quiz.correct_answer
      };
    });
    
    // 参加者の総数を取得
    const totalParticipants = db.prepare('SELECT COUNT(DISTINCT player_id) as count FROM answer WHERE quiz_id = ?').get(id);
    
    // 正解者の数を取得
    const correctAnswers = db.prepare(`
      SELECT COUNT(*) as count 
      FROM answer 
      WHERE quiz_id = ? AND is_correct = 1
    `).get(id);
    
    res.json({
      quizId: parseInt(id),
      totalParticipants: totalParticipants.count,
      correctAnswers: correctAnswers.count,
      stats
    });
  } catch (error) {
    console.error('クイズ統計の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ランキングの取得
router.get('/ranking/all', (req, res) => {
  try {
    const db = getDb();
    
    // プレイヤーごとの正答数と合計回答時間を取得
    const rankings = db.prepare(`
      SELECT 
        p.id as player_id,
        p.name as player_name,
        COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) as correct_count,
        SUM(a.response_time) as total_time,
        COUNT(DISTINCT a.quiz_id) as quiz_count
      FROM 
        player p
      LEFT JOIN 
        answer a ON p.id = a.player_id
      GROUP BY 
        p.id
      ORDER BY 
        correct_count DESC,
        total_time ASC
      LIMIT 30
    `).all();
    
    res.json(rankings);
  } catch (error) {
    console.error('ランキングの取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
