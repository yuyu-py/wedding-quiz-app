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
    
    // 問題5は特別処理 - 実践フェーズの完了後のみ解答公開
    if (id === '5') {
      // 最新のセッションで実践フェーズ完了かつ解答表示フラグが立っているか確認
      const db = require('../database/db');
      
      // セッションテーブルから該当クイズIDの最新セッションを取得
      const params = {
        TableName: db.TABLES.SESSION,
        IndexName: 'quiz_id-index',
        KeyConditionExpression: 'quiz_id = :quizId',
        ExpressionAttributeValues: {
          ':quizId': '5'
        },
        ScanIndexForward: false, // 降順（最新のものから）
        Limit: 1 // 最新の1件のみ
      };
      
      const result = await db.dynamodb.send(new db.QueryCommand(params));
      
      if (result.Items && result.Items.length > 0) {
        const session = result.Items[0];
        
        // answer_displayed が true で、かつ custom_answer が設定されている場合のみ解答公開中
        const isAvailable = session.answer_displayed === true && 
                           (session.custom_answer === '新郎' || session.custom_answer === '新婦');
        
        return res.json({ available: isAvailable });
      }
      
      return res.json({ available: false });
    }
    
    // 問題1-4は通常処理
    const isAnswerAvailable = await db.isQuizAnswerAvailable(id);
    
    res.json({ available: isAnswerAvailable });
  } catch (error) {
    console.error('解答公開状態の確認中にエラーが発生しました:', error);
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