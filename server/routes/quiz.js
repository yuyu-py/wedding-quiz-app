// server/routes/quiz.js
const express = require('express');
const router = express.Router();
const db = require('../database/db'); // db.jsから直接インポート

// 全てのクイズを取得
router.get('/', async (req, res) => {
  try {
    const quizzes = await db.getAllQuizzes();
    
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await db.getQuiz(id);
    
    if (!quiz) {
      return res.status(404).json({ error: 'クイズが見つかりません' });
    }
    
    // 解答情報を削除した安全なバージョンを作成
    const safeQuiz = {
      id: quiz.id,
      question: quiz.question,
      options: JSON.parse(quiz.options),
      question_image_path: quiz.question_image_path,
      is_image_options: quiz.is_image_options
    };
    
    res.json(safeQuiz);
  } catch (error) {
    console.error('クイズの取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズセッションの開始
router.post('/start/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // クイズの存在を確認
    const quiz = await db.getQuiz(id);
    if (!quiz) {
      return res.status(404).json({ error: 'クイズが見つかりません' });
    }
    
    // 新しいセッションを開始
    const result = await db.startQuizSession(id);
    
    res.json(result);
  } catch (error) {
    console.error('クイズセッションの開始中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズの回答状況を取得
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await db.getQuizStats(id);
    
    if (!stats) {
      return res.status(404).json({ 
        quizId: parseInt(id),
        totalParticipants: 0,
        correctAnswers: 0,
        stats: []
      });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('クイズ統計の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ランキングの取得
router.get('/ranking/all', async (req, res) => {
  try {
    const rankings = await db.getRankings();
    res.json(rankings);
  } catch (error) {
    console.error('ランキングの取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 参加者数の取得
router.get('/stats/participants', async (req, res) => {
  try {
    const count = await db.getParticipantCount();
    res.json({ count });
  } catch (error) {
    console.error('参加者数の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズの解答が公開されているか確認するAPI
router.get('/:id/answer-available', async (req, res) => {
  try {
    const { id } = req.params;
    
    // クイズの解答が公開されているか確認
    const isAnswerAvailable = await db.isQuizAnswerAvailable(id);
    
    res.json({ available: isAnswerAvailable });
  } catch (error) {
    console.error('解答公開状態の確認中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました', available: false });
  }
});

// タイマー終了を通知するAPI
router.post('/:id/end-timer', async (req, res) => {
  try {
    const { id } = req.params;
    
    // タイマー終了を記録
    await db.markQuizTimerEnded(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('タイマー終了の記録中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;