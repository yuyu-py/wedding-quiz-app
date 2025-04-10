const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const { getDb } = require('../database/db');

// プレイヤーの登録
router.post('/register', (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '名前は必須です' });
    }
    
    const db = getDb();
    const playerId = nanoid(10); // 10文字のユニークID
    
    db.prepare('INSERT INTO player (id, name) VALUES (?, ?)').run(playerId, name);
    
    res.json({ 
      success: true, 
      playerId,
      name,
      message: 'プレイヤーが登録されました' 
    });
  } catch (error) {
    console.error('プレイヤー登録中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プレイヤー情報の取得
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const player = db.prepare('SELECT id, name, joined_at FROM player WHERE id = ?').get(id);
    
    if (!player) {
      return res.status(404).json({ error: 'プレイヤーが見つかりません' });
    }
    
    res.json(player);
  } catch (error) {
    console.error('プレイヤー情報の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズの回答を提出
router.post('/answer', (req, res) => {
  try {
    const { playerId, quizId, answer, responseTime } = req.body;
    
    if (!playerId || !quizId || !answer) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }
    
    const db = getDb();
    
    // プレイヤーの存在確認
    const player = db.prepare('SELECT id FROM player WHERE id = ?').get(playerId);
    if (!player) {
      return res.status(404).json({ error: 'プレイヤーが見つかりません' });
    }
    
    // クイズの存在確認と正解の取得
    const quiz = db.prepare('SELECT correct_answer FROM quiz WHERE id = ?').get(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'クイズが見つかりません' });
    }
    
    // アクティブなクイズセッションを確認
    const session = db.prepare(`
      SELECT id, started_at 
      FROM quiz_session 
      WHERE quiz_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC 
      LIMIT 1
    `).get(quizId);
    
    if (!session) {
      return res.status(400).json({ error: 'このクイズは現在開始されていません' });
    }
    
    // 同じセッションで既に回答済みか確認
    const existingAnswer = db.prepare(`
      SELECT id FROM answer 
      WHERE player_id = ? AND quiz_id = ?
    `).get(playerId, quizId);
    
    if (existingAnswer) {
      return res.status(400).json({ error: 'このクイズには既に回答済みです' });
    }
    
    // 実際の応答時間 (ミリ秒) 
    // クライアントから送信された応答時間を使用するか、なければ現在時刻との差分を計算
    let actualResponseTime = responseTime;
    if (!actualResponseTime) {
      const sessionStartTime = new Date(session.started_at).getTime();
      const answerTime = new Date().getTime();
      actualResponseTime = answerTime - sessionStartTime;
    }
    
    // 負の応答時間を防ぐ（万が一のため）
    if (actualResponseTime < 0) {
      actualResponseTime = 0;
    }
    
    // 正解かどうか判定
    const isCorrect = answer === quiz.correct_answer;
    
    // 回答を保存
    db.prepare(`
      INSERT INTO answer (player_id, quiz_id, answer, is_correct, response_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(playerId, quizId, answer, isCorrect ? 1 : 0, actualResponseTime);
    
    res.json({
      success: true,
      playerId,
      quizId,
      answer,
      isCorrect,
      responseTime: actualResponseTime,
      message: '回答が記録されました'
    });
  } catch (error) {
    console.error('回答の提出中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プレイヤーの回答履歴を取得
router.get('/:id/answers', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const player = db.prepare('SELECT id, name FROM player WHERE id = ?').get(id);
    
    if (!player) {
      return res.status(404).json({ error: 'プレイヤーが見つかりません' });
    }
    
    const answers = db.prepare(`
      SELECT 
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
    
    // 総合成績を計算
    const stats = {
      totalAnswered: answers.length,
      correctCount: answers.filter(a => a.is_correct).length,
      totalResponseTime: answers.reduce((sum, a) => sum + a.response_time, 0)
    };
    
    res.json({
      player,
      stats,
      answers
    });
  } catch (error) {
    console.error('回答履歴の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
