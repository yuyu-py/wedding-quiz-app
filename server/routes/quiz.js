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

// 参加者数の統計を取得
router.get('/stats/participants', async (req, res) => {
  try {
    const count = await db.getParticipantCount();
    res.json({ count });
  } catch (error) {
    console.error('参加者数の取得中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズの解答が公開されているか確認するAPI（自動遷移用）
router.get('/:id/answer-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 問題5の場合は特別対応
    if (id === '5') {
      // 最新のセッションを取得して解答が設定されているか確認
      const db = require('../database/db');
      
      // AWS SDKのCommandを正しくインポート
      const { QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
      
      const sessionParams = {
        TableName: db.TABLES.SESSION,
        IndexName: 'quiz_id-index',
        KeyConditionExpression: 'quiz_id = :quizId',
        ExpressionAttributeValues: {
          ':quizId': '5'
        },
        ScanIndexForward: false, // 最新のものを先頭に
        Limit: 1
      };
      
      // 修正: 正しいQueryCommandコンストラクタを使用
      const sessionResult = await db.dynamodb.send(new QueryCommand(sessionParams));
      
      // 問題5の答えを直接取得
      const quizParams = {
        TableName: db.TABLES.QUIZ,
        Key: { id: '5' }
      };
      
      // 修正: 正しいGetCommandコンストラクタを使用
      const quizResult = await db.dynamodb.send(new GetCommand(quizParams));
      
      // セッションか答えが存在しない場合は利用不可
      if (!sessionResult.Items || 
          sessionResult.Items.length === 0 || 
          !quizResult.Item) {
        return res.json({ available: false });
      }
      
      const session = sessionResult.Items[0];
      const quiz = quizResult.Item;
      
      // 答えが設定されていて（空でなく）、かつ表示フラグが立っている場合のみ利用可能
      const isAvailable = (quiz.correct_answer && 
                           quiz.correct_answer !== '' && 
                           session.answer_displayed === true);
      
      return res.json({ 
        available: isAvailable,
        answer: isAvailable ? quiz.correct_answer : null
      });
    }
    
    // 通常問題の場合は既存の処理
    const isAnswerAvailable = await db.isQuizAnswerAvailable(id);
    return res.json({ available: isAnswerAvailable });
    
  } catch (error) {
    console.error('解答状態の確認中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました', available: false });
  }
});

// 解答が表示されたことをマークするAPI（自動遷移用）
router.post('/admin/quiz/:id/mark-answer-displayed', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 解答表示フラグをセットする関数を呼び出す
    const result = await db.markAnswerAsDisplayed(id);
    
    if (result) {
      // Socket.ioで通知を送信して全クライアントに知らせる
      if (global.io) {
        global.io.emit('quiz_event', { 
          event: 'answer_available',
          quizId: id
        });
      }
      
      res.json({ success: true, message: `クイズ ${id} の解答表示フラグを設定しました` });
    } else {
      res.status(500).json({ success: false, error: '解答表示フラグの設定に失敗しました' });
    }
  } catch (error) {
    console.error('解答表示フラグの設定中にエラーが発生しました:', error);
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;