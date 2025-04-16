// server/routes/player.js
const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const db = require('../database/db'); // db.jsから直接インポート

// プレイヤーの登録
router.post('/register', async (req, res) => {
  try {
    const { name, tableNumber } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '名前は必須です' });
    }
    
    // テーブル番号のバリデーション - オプショナルに変更
    if (tableNumber && !['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(tableNumber)) {
      return res.status(400).json({ error: 'テーブル番号が無効です' });
    }
    
    const playerId = nanoid(10);
    const success = await db.registerPlayer(playerId, name, tableNumber);
    
    if (success) {
      res.json({ 
        success: true, 
        playerId,
        name,
        tableNumber,
        message: 'プレイヤーが登録されました' 
      });
    } else {
      res.status(500).json({ error: 'プレイヤー登録に失敗しました' });
    }
  } catch (error) {
    console.error('プレイヤー登録中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プレイヤー情報の取得
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const player = await db.getPlayer(id);
    
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
// routes/player.js - 回答処理の改善
router.post('/answer', async (req, res) => {
  try {
    const { playerId, quizId, answer, responseTime } = req.body;
    
    // プレイヤーの存在確認
    const player = await db.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({ error: 'プレイヤーが見つかりません' });
    }
    
    // クイズの存在確認と正解の取得
    const quiz = await db.getQuiz(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'クイズが見つかりません' });
    }
    
    // デバッグログ追加（問題5のみ）
    if (quizId === '5') {
      console.log(`問題5回答処理: プレイヤー回答="${answer}", システム正解="${quiz.correct_answer}"`);
    }
    
    // 正解かどうか判定
    const isCorrect = answer === quiz.correct_answer;
    
    // 回答を保存
    const success = await db.recordAnswer(playerId, quizId, answer, isCorrect, responseTime);
    
    if (success) {
      res.json({
        success: true,
        playerId,
        quizId,
        answer,
        isCorrect,
        responseTime,
        message: '回答が記録されました'
      });
    } else {
      res.status(500).json({ error: '回答の記録に失敗しました' });
    }
  } catch (error) {
    console.error('回答の提出中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プレイヤーの回答履歴を取得
router.get('/:id/answers', async (req, res) => {
  try {
    const { id } = req.params;
    
    const player = await db.getPlayer(id);
    if (!player) {
      return res.status(404).json({ error: 'プレイヤーが見つかりません' });
    }
    
    const answers = await db.getPlayerAnswers(id);
    
    // プレイヤーごとの統計情報を計算
    let correctCount = 0;
    let totalResponseTime = 0;
    
    answers.forEach(answer => {
      if (answer.is_correct === 1) {
        correctCount++;
      }
      totalResponseTime += answer.response_time || 0;
    });
    
    const stats = {
      totalAnswered: answers.length,
      correctCount,
      totalResponseTime
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