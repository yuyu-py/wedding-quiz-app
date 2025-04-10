const express = require('express');
const router = express.Router();
const { getDb, setQuiz5Answer } = require('../database/db');

// クイズの解答を表示
router.get('/quiz/:id/answer', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const quiz = db.prepare(`
      SELECT id, question, options, correct_answer, explanation, question_image_path, answer_image_path, is_image_options 
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
    console.error('クイズ解答の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズセッションの終了
router.post('/quiz/:id/end', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    // 進行中のセッションを終了
    db.prepare(`
      UPDATE quiz_session 
      SET ended_at = CURRENT_TIMESTAMP 
      WHERE quiz_id = ? AND ended_at IS NULL
    `).run(id);
    
    res.json({ 
      success: true, 
      message: `クイズ ${id} のセッションが終了しました` 
    });
  } catch (error) {
    console.error('クイズセッションの終了中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 参加者の一覧取得
router.get('/players', (req, res) => {
  try {
    const db = getDb();
    
    const players = db.prepare(`
      SELECT 
        p.id, 
        p.name, 
        p.joined_at,
        COUNT(DISTINCT a.quiz_id) as answered_quiz_count
      FROM 
        player p
      LEFT JOIN 
        answer a ON p.id = a.player_id
      GROUP BY 
        p.id
      ORDER BY 
        p.joined_at DESC
    `).all();
    
    res.json(players);
  } catch (error) {
    console.error('参加者の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プレイヤーの回答履歴を取得
router.get('/player/:id/answers', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const player = db.prepare('SELECT id, name FROM player WHERE id = ?').get(id);
    
    if (!player) {
      return res.status(404).json({ error: '参加者が見つかりません' });
    }
    
    const answers = db.prepare(`
      SELECT 
        a.id as answer_id,
        a.quiz_id,
        q.question,
        a.answer,
        a.is_correct,
        a.response_time,
        a.answered_at
      FROM 
        answer a
      JOIN 
        quiz q ON a.quiz_id = q.id
      WHERE 
        a.player_id = ?
      ORDER BY 
        a.answered_at DESC
    `).all(id);
    
    res.json({
      player,
      answers
    });
  } catch (error) {
    console.error('回答履歴の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズ5の答えを設定
router.post('/quiz/5/set-answer', (req, res) => {
  try {
    const { answer } = req.body;
    
    if (!answer || (answer !== '新郎' && answer !== '新婦')) {
      return res.status(400).json({ error: '答えは「新郎」または「新婦」である必要があります' });
    }
    
    const result = setQuiz5Answer(answer);
    
    res.json({ 
      success: result, 
      answer,
      message: `クイズ5の答えを「${answer}」に設定しました` 
    });
  } catch (error) {
    console.error('クイズ5の答え設定中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// すべてのデータをリセット
router.post('/reset-all', (req, res) => {
  try {
    const db = getDb();
    
    // トランザクション開始
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // セッションデータを削除
      db.prepare('DELETE FROM quiz_session').run();
      
      // 回答データを削除
      db.prepare('DELETE FROM answer').run();
      
      // プレイヤーデータを削除
      db.prepare('DELETE FROM player').run();
      
      // クイズ5の回答をリセット
      db.prepare('UPDATE quiz SET correct_answer = ? WHERE id = 5').run('');
      
      // トランザクション確定
      db.prepare('COMMIT').run();
      
      res.json({ 
        success: true, 
        message: 'すべてのデータがリセットされました' 
      });
    } catch (error) {
      // エラー発生時はロールバック
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('データリセット中にエラーが発生しました:', error);
    res.status(500).json({ 
      success: false,
      error: 'サーバーエラーが発生しました' 
    });
  }
});

module.exports = router;
