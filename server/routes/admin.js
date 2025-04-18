// server/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../database/db'); // db.jsから直接インポート

// クイズの解答を表示
router.get('/quiz/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await db.getQuiz(id);
    
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
router.post('/quiz/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 特定のセッション終了関数がDynamoDB用に実装されていない場合
    // startQuizSessionの中で既存セッションを終了する処理を使用
    await db.startQuizSession(id); // これは既存セッションを終了してから新しいセッションを作成
    
    res.json({ 
      success: true, 
      message: `クイズ ${id} のセッションが終了しました` 
    });
  } catch (error) {
    console.error('クイズセッションの終了中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// クイズ5の答えを設定
router.post('/quiz/5/set-answer', async (req, res) => {
  try {
    const { answer } = req.body;
    
    console.log(`[DEBUG] 問題5答え設定リクエスト: answer="${answer}", 型=${typeof answer}`);
    
    if (!answer || (answer !== '新郎' && answer !== '新婦')) {
      return res.status(400).json({ 
        success: false,
        error: '答えは「新郎」または「新婦」である必要があります' 
      });
    }
    
    // 問題5の答えを設定
    const result = await db.setQuiz5Answer(answer);
    
    console.log(`[DEBUG] 問題5答え設定結果: ${result ? '成功' : '失敗'}, answer="${answer}"`);
    
    if (result) {
      // 追加: 既存の回答を再評価する処理
      try {
        console.log(`[DEBUG] 問題5の既存回答を再評価します`);
        // 問題5のすべての回答を取得
        const answersParams = {
          TableName: db.TABLES.ANSWER,
          IndexName: 'quiz_id-index', 
          KeyConditionExpression: 'quiz_id = :quizId',
          ExpressionAttributeValues: {
            ':quizId': '5'
          }
        };
        
        const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
        const answersResult = await db.dynamodb.send(new QueryCommand(answersParams));
        const answers = answersResult.Items || [];
        
        console.log(`[DEBUG] 既存回答数: ${answers.length}`);
        
        // 各回答を再評価
        for (const answerItem of answers) {
          const isCorrect = answerItem.answer === answer ? 1 : 0;
          const oldIsCorrect = answerItem.is_correct;
          
          if (isCorrect !== oldIsCorrect) {
            // 正誤判定を更新
            const updateParams = {
              TableName: db.TABLES.ANSWER,
              Key: {
                player_id: answerItem.player_id,
                quiz_id: answerItem.quiz_id
              },
              UpdateExpression: 'set is_correct = :isCorrect',
              ExpressionAttributeValues: {
                ':isCorrect': isCorrect
              },
              ReturnValues: 'UPDATED_NEW'
            };
            
            const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
            await db.dynamodb.send(new UpdateCommand(updateParams));
            console.log(`[DEBUG] 回答を更新: player=${answerItem.player_id}, 回答="${answerItem.answer}", 判定=${oldIsCorrect}→${isCorrect}`);
          }
        }
        
        // ランキングキャッシュをクリア
        if (typeof db.cache !== 'undefined' && db.cache.del) {
          db.cache.del('rankings');
          console.log(`[DEBUG] ランキングキャッシュをクリア`);
        }
      } catch (recalcError) {
        console.error('既存回答の再評価中にエラーが発生しました:', recalcError);
      }
      
      // 答え設定成功時に全クライアントに通知
      if (global.io) {
        global.io.emit('quiz5_answer_set', {
          answer
        });
      }
      
      res.json({ 
        success: true, 
        answer,
        message: `クイズ5の答えを「${answer}」に設定しました` 
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: '答えの設定に失敗しました' 
      });
    }
  } catch (error) {
    console.error('クイズ5の答え設定中にエラーが発生しました:', error);
    res.status(500).json({ 
      success: false,
      error: 'サーバーエラーが発生しました' 
    });
  }
});


// 新規追加: 解答表示状態を記録するAPI
router.post('/quiz/:id/mark-answer-displayed', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 解答表示状態を記録
    const result = await db.markAnswerAsDisplayed(id);
    
    res.json({ 
      success: result, 
      message: `クイズ ${id} の解答表示状態を更新しました` 
    });
  } catch (error) {
    console.error('解答表示状態の更新中にエラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// すべてのデータをリセット
router.post('/reset-all', async (req, res) => {
  try {
    const result = await db.resetAllData();
    
    if (result) {
      res.json({ 
        success: true, 
        message: 'すべてのデータがリセットされました' 
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'データリセット中にエラーが発生しました' 
      });
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