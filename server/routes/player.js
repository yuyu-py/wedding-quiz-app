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
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-SERVER] 回答受付: プレイヤー=${playerId}, 問題=${quizId}, 回答="${answer}", 型=${typeof answer}`);
    }
    
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
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-SERVER] クイズデータ: ${JSON.stringify(quiz)}`);
    }
    
    // デバッグログ追加（問題5のみ）
    if (quizId === '5') {
      console.log(`問題5回答処理: プレイヤー回答="${answer}", システム正解="${quiz.correct_answer}"`);
    }
    
    // 正解かどうか判定
    const isCorrect = answer === quiz.correct_answer;
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-SERVER] 正誤判定: ${isCorrect ? '正解' : '不正解'}, プレイヤー回答="${answer}", 正解="${quiz.correct_answer}", 型=${typeof answer}/${typeof quiz.correct_answer}`);
      
      // 問題5の特殊ケース：正解が空の場合（まだ管理者が設定していない）
      if (quiz.correct_answer === '') {
        console.log(`[DEBUG-Q5-SERVER] 問題5: 正解未設定で仮判定`);
      }
    }
    
    // 回答を保存
    const success = await db.recordAnswer(playerId, quizId, answer, isCorrect, responseTime);
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-SERVER] DB記録: player=${playerId}, quiz=${quizId}, answer="${answer}", isCorrect=${isCorrect}, responseTime=${responseTime}`);
    }
    
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

// 個別の回答を取得するAPI（問題5専用）
router.get('/:id/answer/:quizId', async (req, res) => {
  try {
    const { id, quizId } = req.params;
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-SERVER] 回答取得リクエスト: player=${id}, quiz=${quizId}`);
    }
    
    // プレイヤーの存在確認
    const player = await db.getPlayer(id);
    if (!player) {
      return res.status(404).json({ success: false, error: 'プレイヤーが見つかりません' });
    }
    
    // 特定の回答を取得
    const answerParams = {
      TableName: db.TABLES.ANSWER,
      Key: {
        player_id: id,
        quiz_id: quizId
      }
    };
    
    const { GetCommand } = require('@aws-sdk/lib-dynamodb');
    const answerResult = await db.dynamodb.send(new GetCommand(answerParams));
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-SERVER] 回答取得結果: ${JSON.stringify(answerResult.Item || {})}`);
    }
    
    if (!answerResult.Item) {
      return res.status(404).json({ success: false, error: '回答が見つかりません' });
    }
    
    res.json({
      success: true,
      answer: answerResult.Item
    });
    
  } catch (error) {
    console.error('回答取得中にエラーが発生しました:', error);
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;