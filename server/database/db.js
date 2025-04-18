// server/database/db.js - AWS SDK v3 バージョン
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand 
} = require('@aws-sdk/lib-dynamodb');
const NodeCache = require('node-cache');
require('dotenv').config();

// キャッシュの設定（60秒）
const cache = new NodeCache({ stdTTL: 60 });

// DynamoDB クライアントの設定
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1'
  // AWS 認証情報は ~/.aws/credentials から自動的に読み込まれます
});

// DynamoDB ドキュメントクライアント
const dynamodb = DynamoDBDocumentClient.from(client);

// テーブル名のプレフィックス
const tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || 'wedding_quiz_';

// テーブル名の定義
const TABLES = {
  QUIZ: `${tablePrefix}quiz`,
  PLAYER: `${tablePrefix}player`,
  ANSWER: `${tablePrefix}answer`,
  SESSION: `${tablePrefix}session`
};

// DynamoDBの初期化
async function initDb() {
  console.log('DynamoDB接続の初期化を開始します...');
  
  try {
    // サンプルクイズデータを確認・追加
    const quizCount = await countQuizItems();
    console.log(`既存のクイズデータ: ${quizCount}件`);
    
    if (quizCount === 0) {
      await insertSampleQuizData();
      console.log('サンプルクイズデータを追加しました');
    }
    
    console.log('DynamoDB接続の初期化が完了しました');
  } catch (error) {
    console.error('DynamoDB初期化中にエラーが発生しました:', error);
  }
}

// クイズアイテム数を取得
async function countQuizItems() {
  try {
    const params = {
      TableName: TABLES.QUIZ,
      Select: 'COUNT'
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    return result.Count;
  } catch (error) {
    console.error('クイズ数の取得中にエラーが発生しました:', error);
    return 0;
  }
}

// サンプルクイズデータの挿入
async function insertSampleQuizData() {
  const quizItems = [
    {
      id: '1',
      question: '下記の記号の法則を見つけ、?に入るものを選択しろ。',
      options: JSON.stringify(['UCC', 'USJ', 'URL', 'USA']),
      correct_answer: 'USA',
      explanation: '答えはUSAです。U○○の形式で、国や組織の略称になっています。',
      question_image_path: '/images/quiz-images/quiz1_question.png',
      answer_image_path: '/images/quiz-images/quiz1_answer.png',
      is_image_options: 0,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      question: '下記の中国語で表されるキャラクターは？',
      options: JSON.stringify(['ピカチュウ(Pokemon)', 'ジェリー(Tom and Jerry)', 'ミッキーマウス(Disney)', 'ハム太郎(とっとこハム太郎)']),
      correct_answer: 'ミッキーマウス(Disney)',
      explanation: '答えはミッキーマウスです。中国語では「米老鼠」と表記されます。',
      question_image_path: '/images/quiz-images/quiz2_question.png',
      answer_image_path: '/images/quiz-images/quiz2_answer.png',
      is_image_options: 0,
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      question: '新婦が作成した合成写真はどちらでしょう？',
      options: JSON.stringify([
        '/images/quiz-images/quiz3_option1.jpg', 
        '/images/quiz-images/quiz3_option2.JPG', 
        '/images/quiz-images/quiz3_option3.JPG', 
        '/images/quiz-images/quiz3_option4.jpg'
      ]),
      correct_answer: '2',
      explanation: '新郎が新婦の生誕10000日のためにタルトを作って蝋燭を立てたが、0を一個買い忘れたので合成してくれた',
      question_image_path: '', 
      answer_image_path: '',
      is_image_options: 1,
      created_at: new Date().toISOString()
    },
    {
      id: '4',
      question: '新郎が疑いをかけられた冤罪とは？',
      options: JSON.stringify([
        '/images/quiz-images/quiz4_option1.png',
        '/images/quiz-images/quiz4_option2.png',
        '/images/quiz-images/quiz4_option3.png',
        '/images/quiz-images/quiz4_option4.png'
      ]),
      correct_answer: '3',
      explanation: '私は優柔不断で、スーパーでお菓子を何にしようか決められず、30分ほどうろうろと商品を手に取ったり戻したりを繰り返していました。この不審な様子からGメンに声をかけられましたが、カバンの中身を確認してもらい、無実が証明されました。',
      question_image_path: '',
      answer_image_path: '/images/quiz-images/quiz4_answer.png',
      is_image_options: 1,
      created_at: new Date().toISOString()
    },
    {
      id: '5',
      question: 'ストップウォッチ15秒に近く止められるのはどっち？',
      options: JSON.stringify(['新郎', '新婦']),
      correct_answer: '',
      explanation: '実際に計測した結果です。', 
      question_image_path: '',
      answer_image_path: '',
      is_image_options: 0,
      created_at: new Date().toISOString()
    }
  ];
  
  console.log('サンプルクイズデータの挿入を開始します...');
  
  // 1つずつ挿入
  for (const item of quizItems) {
    const params = {
      TableName: TABLES.QUIZ,
      Item: item
    };
    
    try {
      await dynamodb.send(new PutCommand(params));
      console.log(`クイズ ${item.id} を挿入しました`);
    } catch (error) {
      console.error(`クイズ ${item.id} の挿入中にエラーが発生しました:`, error);
      throw error;
    }
  }
}

// クイズ5の答えを設定
async function setQuiz5Answer(answer) {
  try {
    console.log(`[DEBUG-Q5-DB] 問題5答え設定開始: answer="${answer}", 型=${typeof answer}`);
    
    // キャッシュをクリア
    cache.del(`quiz_5`);
    
    const params = {
      TableName: TABLES.QUIZ,
      Key: { id: '5' },
      UpdateExpression: 'set correct_answer = :answer',
      ExpressionAttributeValues: {
        ':answer': answer
      },
      ReturnValues: 'UPDATED_NEW'
    };
    
    const result = await dynamodb.send(new UpdateCommand(params));
    console.log(`[DEBUG-Q5-DB] 問題5答え更新結果: ${JSON.stringify(result)}`);
    
    // 現在のセッションにカスタム答えを記録
    // 最新の未終了セッションを取得
    const queryParams = {
      TableName: TABLES.SESSION,
      IndexName: 'quiz_id-index', 
      KeyConditionExpression: 'quiz_id = :quizId',
      FilterExpression: 'attribute_not_exists(ended_at)',
      ExpressionAttributeValues: {
        ':quizId': '5'
      },
      ScanIndexForward: false,
      Limit: 1
    };
    
    try {
      const result = await dynamodb.send(new QueryCommand(queryParams));
      
      if (result.Items && result.Items.length > 0) {
        const session = result.Items[0];
        console.log(`[DEBUG-Q5-DB] 現在のセッション: ${JSON.stringify(session)}`);
        
        const updateParams = {
          TableName: TABLES.SESSION,
          Key: { 
            quiz_id: session.quiz_id,
            started_at: session.started_at
          },
          UpdateExpression: 'set custom_answer = :answer',
          ExpressionAttributeValues: {
            ':answer': answer
          }
        };
        
        const updateResult = await dynamodb.send(new UpdateCommand(updateParams));
        console.log(`[DEBUG-Q5-DB] セッション更新結果: ${JSON.stringify(updateResult)}`);
      } else {
        console.log(`[DEBUG-Q5-DB] 問題5の進行中セッションが見つかりません`);
      }
    } catch (error) {
      console.error('[ERROR-Q5-DB] セッション情報の更新中にエラー:', error);
      // クイズの答えだけは更新できているので、true を返す
    }
    
    // 既存回答の正誤判定を更新する関数呼び出し
    await updateExistingAnswersForQuiz5(answer);
    
    return true;
  } catch (error) {
    console.error('[ERROR-Q5-DB] クイズ5の答え設定中にエラー:', error);
    return false;
  }
}

// 問題5用の既存回答更新専用関数
async function updateExistingAnswersForQuiz5(answer) {
  try {
    console.log(`[DEBUG-Q5-DB] 問題5既存回答更新開始: answer="${answer}"`);
    
    // 問題5のすべての回答を取得
    const answersParams = {
      TableName: TABLES.ANSWER,
      IndexName: 'quiz_id-index', 
      KeyConditionExpression: 'quiz_id = :quizId',
      ExpressionAttributeValues: {
        ':quizId': '5'
      }
    };
    
    const answersResult = await dynamodb.send(new QueryCommand(answersParams));
    const answers = answersResult.Items || [];
    
    console.log(`[DEBUG-Q5-DB] 問題5既存回答数: ${answers.length}`);
    console.log(`[DEBUG-Q5-DB] 回答詳細: ${JSON.stringify(answers)}`);
    
    // 各回答を再評価
    let updateCount = 0;
    
    for (const answerItem of answers) {
      // プレイヤーの回答と設定された正解を比較
      const isCorrect = answerItem.answer === answer ? 1 : 0;
      const oldIsCorrect = answerItem.is_correct;
      
      console.log(`[DEBUG-Q5-DB] 回答比較: "${answerItem.answer}" vs "${answer}" => ${isCorrect} (現在値=${oldIsCorrect})`);
      
      if (isCorrect !== oldIsCorrect) {
        // 正誤判定を更新
        const updateParams = {
          TableName: TABLES.ANSWER,
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
        
        try {
          const updateResult = await dynamodb.send(new UpdateCommand(updateParams));
          console.log(`[DEBUG-Q5-DB] 回答更新成功: player=${answerItem.player_id}, 判定=${oldIsCorrect}→${isCorrect}, 結果=${JSON.stringify(updateResult)}`);
          updateCount++;
        } catch (updateError) {
          console.error(`[ERROR-Q5-DB] 回答更新失敗: player=${answerItem.player_id}`, updateError);
        }
      } else {
        console.log(`[DEBUG-Q5-DB] 判定に変更なし: player=${answerItem.player_id}, 判定=${oldIsCorrect}`);
      }
    }
    
    console.log(`[DEBUG-Q5-DB] 問題5回答更新完了: 全${answers.length}件中${updateCount}件更新`);
    return true;
  } catch (error) {
    console.error('[ERROR-Q5-DB] 問題5既存回答更新でエラー:', error);
    return false;
  }
}

// 特定のクイズを取得
async function getQuiz(id) {
  const cacheKey = `quiz_${id}`;
  
  // キャッシュをチェック
  if (cache.has(cacheKey)) {
    const cachedQuiz = cache.get(cacheKey);
    
    // 問題5のデバッグ
    if (id === '5') {
      console.log(`[DEBUG-Q5-DB] クイズ5キャッシュヒット: ${JSON.stringify(cachedQuiz)}`);
    }
    
    return cachedQuiz;
  }
  
  try {
    const params = {
      TableName: TABLES.QUIZ,
      Key: { id: id.toString() }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    
    if (!result.Item) {
      return null;
    }
    
    // 問題5の場合は、現在のセッションから最新の回答を取得
    if (id === '5') {
      const quiz = result.Item;
      console.log(`[DEBUG-Q5-DB] クイズ5取得: ${JSON.stringify(quiz)}`);
      
      try {
        // 最新の未終了セッションを取得
        const queryParams = {
          TableName: TABLES.SESSION,
          IndexName: 'quiz_id-index', 
          KeyConditionExpression: 'quiz_id = :quizId',
          FilterExpression: 'attribute_not_exists(ended_at)',
          ExpressionAttributeValues: {
            ':quizId': '5'
          },
          ScanIndexForward: false,
          Limit: 1
        };
        
        const sessionResult = await dynamodb.send(new QueryCommand(queryParams));
        
        if (sessionResult.Items && sessionResult.Items.length > 0) {
          const session = sessionResult.Items[0];
          
          // セッションにカスタム答えがあればそれを使用
          if (session.custom_answer) {
            quiz.correct_answer = session.custom_answer;
            console.log(`[DEBUG-Q5-DB] 問題5: セッションからカスタム答え "${quiz.correct_answer}" を使用します`);
          }
        }
      } catch (error) {
        console.error('[ERROR-Q5-DB] 問題5のセッション情報取得中にエラー:', error);
      }
      
      // 結果をキャッシュに保存
      cache.set(cacheKey, quiz);
      return quiz;
    }
    
    // 結果をキャッシュに保存
    cache.set(cacheKey, result.Item);
    return result.Item;
  } catch (error) {
    console.error(`[ERROR-Q5-DB] クイズ ${id} の取得中にエラー:`, error);
    return null;
  }
}


// すべてのクイズを取得
async function getAllQuizzes() {
  const cacheKey = 'all_quizzes';
  
  // キャッシュをチェック
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  try {
    const params = {
      TableName: TABLES.QUIZ
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    
    // 結果をキャッシュに保存
    cache.set(cacheKey, result.Items);
    return result.Items;
  } catch (error) {
    console.error('全クイズの取得中にエラーが発生しました:', error);
    return [];
  }
}

// クイズセッションの開始
async function startQuizSession(quizId) {
  try {
    // 既存の進行中セッションを終了
    const queryParams = {
      TableName: TABLES.SESSION,
      IndexName: 'quiz_id-index',
      KeyConditionExpression: 'quiz_id = :quizId',
      FilterExpression: 'attribute_not_exists(ended_at)',
      ExpressionAttributeValues: {
        ':quizId': quizId.toString()
      }
    };
    
    const existingSessions = await dynamodb.send(new QueryCommand(queryParams));
    
    if (existingSessions.Items && existingSessions.Items.length > 0) {
      for (const session of existingSessions.Items) {
        const endParams = {
          TableName: TABLES.SESSION,
          Key: { 
            quiz_id: session.quiz_id,
            started_at: session.started_at
          },
          UpdateExpression: 'set ended_at = :endedAt',
          ExpressionAttributeValues: {
            ':endedAt': new Date().toISOString()
          }
        };
        
        await dynamodb.send(new UpdateCommand(endParams));
      }
    }
    
    // 新しいセッションを作成
    const startedAt = new Date().toISOString();
    const createParams = {
      TableName: TABLES.SESSION,
      Item: {
        quiz_id: quizId.toString(),
        started_at: startedAt,
        custom_answer: null,
        answer_displayed: false // 初期状態では答えは表示されていない
      }
    };
    
    await dynamodb.send(new PutCommand(createParams));
    
    return {
      success: true,
      sessionId: `${quizId}_${startedAt}`
    };
  } catch (error) {
    console.error(`クイズ ${quizId} のセッション開始中にエラーが発生しました:`, error);
    return {
      success: false,
      error: 'セッション開始中にエラーが発生しました'
    };
  }
}

// プレイヤー登録
async function registerPlayer(id, name, tableNumber = null) {
  try {
    const playerItem = {
      id,
      name,
      joined_at: new Date().toISOString()
    };
    
    // テーブルナンバーが有効な場合のみ追加
    if (tableNumber) {
      playerItem.table_number = tableNumber;
    }
    
    const params = {
      TableName: TABLES.PLAYER,
      Item: playerItem
    };
    
    await dynamodb.send(new PutCommand(params));
    return true;
  } catch (error) {
    console.error(`プレイヤー ${id} の登録中にエラーが発生しました:`, error);
    return false;
  }
}

// プレイヤー情報の取得
async function getPlayer(id) {
  try {
    const params = {
      TableName: TABLES.PLAYER,
      Key: { id }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item;
  } catch (error) {
    console.error(`プレイヤー ${id} の取得中にエラーが発生しました:`, error);
    return null;
  }
}

// プレイヤーの回答を記録
async function recordAnswer(playerId, quizId, answer, isCorrect, responseTime) {
  try {
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-DB] 回答記録: player=${playerId}, quiz=${quizId}, answer="${answer}", isCorrect=${isCorrect}, responseTime=${responseTime}`);
    }
    
    const params = {
      TableName: TABLES.ANSWER,
      Item: {
        player_id: playerId,
        quiz_id: quizId.toString(),
        answer,
        is_correct: isCorrect ? 1 : 0,
        response_time: responseTime,
        answered_at: new Date().toISOString()
      }
    };
    
    await dynamodb.send(new PutCommand(params));
    
    // ランキングキャッシュをクリア
    cache.del('rankings');
    
    // 問題5のデバッグ
    if (quizId === '5') {
      console.log(`[DEBUG-Q5-DB] 回答記録完了: player=${playerId}, quiz=${quizId}`);
    }
    
    return true;
  } catch (error) {
    console.error(`[ERROR-Q5-DB] プレイヤー ${playerId} のクイズ ${quizId} への回答記録中にエラー:`, error);
    return false;
  }
}

// プレイヤーの回答履歴を取得
async function getPlayerAnswers(playerId) {
  try {
    const params = {
      TableName: TABLES.ANSWER,
      KeyConditionExpression: 'player_id = :playerId',
      ExpressionAttributeValues: {
        ':playerId': playerId
      }
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    return result.Items;
  } catch (error) {
    console.error(`プレイヤー ${playerId} の回答履歴取得中にエラーが発生しました:`, error);
    return [];
  }
}

// クイズの回答統計を取得
async function getQuizStats(quizId) {
  try {
    // クイズ情報を取得
    const quiz = await getQuiz(quizId);
    if (!quiz) {
      return null;
    }
    
    const options = JSON.parse(quiz.options);
    
    // クイズに対する回答を取得
    const params = {
      TableName: TABLES.ANSWER,
      IndexName: 'quiz_id-index',
      KeyConditionExpression: 'quiz_id = :quizId',
      ExpressionAttributeValues: {
        ':quizId': quizId.toString()
      }
    };
    
    const answers = await dynamodb.send(new QueryCommand(params));
    
    // 各選択肢の回答数を集計
    const stats = options.map(option => {
      const count = answers.Items ? 
        answers.Items.filter(a => a.answer === option).length : 0;
      
      return {
        option,
        count,
        isCorrect: option === quiz.correct_answer
      };
    });
    
    // 総回答数と正解数
    const totalParticipants = answers.Items ? 
      new Set(answers.Items.map(a => a.player_id)).size : 0;
    
    const correctAnswers = answers.Items ? 
      answers.Items.filter(a => a.is_correct === 1).length : 0;
    
    return {
      quizId: parseInt(quizId),
      totalParticipants,
      correctAnswers,
      stats
    };
  } catch (error) {
    console.error(`クイズ ${quizId} の統計取得中にエラーが発生しました:`, error);
    return null;
  }
}

// 参加者数を取得
async function getParticipantCount() {
  try {
    const params = {
      TableName: TABLES.PLAYER,
      Select: 'COUNT'
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    return result.Count;
  } catch (error) {
    console.error('参加者数の取得中にエラーが発生しました:', error);
    return 0;
  }
}

// ランキングの取得
async function getRankings() {
  const cacheKey = 'rankings';
  
  // キャッシュをチェック
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  try {
    // すべてのプレイヤーを取得
    const playersParams = {
      TableName: TABLES.PLAYER
    };
    
    const playersResult = await dynamodb.send(new ScanCommand(playersParams));
    const players = playersResult.Items || [];
    
    // ランキング計算のためのデータを収集
    const rankingData = [];
    
    for (const player of players) {
      // プレイヤーの回答を取得
      const answersParams = {
        TableName: TABLES.ANSWER,
        KeyConditionExpression: 'player_id = :playerId',
        ExpressionAttributeValues: {
          ':playerId': player.id
        }
      };
      
      const answersResult = await dynamodb.send(new QueryCommand(answersParams));
      const answers = answersResult.Items || [];
      
      // 修正: 正答した問題のみの合計回答時間を計算
      const correctAnswers = answers.filter(a => a.is_correct === 1);
      const correctCount = correctAnswers.length;
      const totalTime = correctAnswers.reduce((sum, a) => sum + a.response_time, 0);
      
      rankingData.push({
        player_id: player.id,
        player_name: player.name,
        table_number: player.table_number || '-',
        correct_count: correctCount,
        total_time: totalTime,
        quiz_count: answers.length
      });
    }
    
    // 正答数で降順、同点なら回答時間で昇順にソート
    rankingData.sort((a, b) => {
      if (a.correct_count !== b.correct_count) {
        return b.correct_count - a.correct_count; // 正答数で降順
      }
      return a.total_time - b.total_time; // 回答時間で昇順
    });
    
    // 同率順位を計算して追加
    let currentRank = 1;
    let prevCorrectCount = null;
    let prevTotalTime = null;
    
    const rankedData = rankingData.map((item, index) => {
      if (index > 0 && 
          item.correct_count === prevCorrectCount && 
          item.total_time === prevTotalTime) {
        // 前のプレイヤーと同じスコアなら同じ順位
        // ランクはそのまま
      } else if (index > 0) {
        // 異なるスコアなら実際のインデックス+1を順位とする
        currentRank = index + 1;
      }
      
      // 比較用に値を保存
      prevCorrectCount = item.correct_count;
      prevTotalTime = item.total_time;
      
      // 順位を追加
      return {
        ...item,
        rank: currentRank
      };
    });
    
    // 上位50件に制限
    const limitedRankings = rankedData.slice(0, 50);
    
    // 結果をキャッシュに保存
    cache.set(cacheKey, limitedRankings);
    return limitedRankings;
  } catch (error) {
    console.error('ランキングの取得中にエラーが発生しました:', error);
    return [];
  }
}

// クイズの解答が公開されているか確認する関数（自動遷移用）
async function isQuizAnswerAvailable(quizId) {
  console.log(`[DEBUG] 解答表示状態確認 - QuizID: ${quizId}`);
  
  // キャッシュをチェック
  const cacheKey = `answer_displayed_${quizId}`;
  if (cache.has(cacheKey)) {
    const result = cache.get(cacheKey);
    console.log(`[DEBUG] キャッシュから取得: ${result}`);
    return result;
  }
  
  try {
    // セッションテーブルから該当クイズIDの最新セッションを取得
    const params = {
      TableName: TABLES.SESSION,
      IndexName: 'quiz_id-index',
      KeyConditionExpression: 'quiz_id = :quizId',
      ExpressionAttributeValues: {
        ':quizId': quizId.toString()
      },
      ScanIndexForward: false, // 降順（最新のものから）
      Limit: 1 // 最新の1件のみ
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    
    console.log(`[DEBUG] DB結果: ${JSON.stringify(result.Items)}`);
    
    if (result.Items && result.Items.length > 0) {
      const session = result.Items[0];
      console.log(`[DEBUG] セッション: ${JSON.stringify(session)}`);
      const isAvailable = session.answer_displayed === true;
      console.log(`[DEBUG] 解答利用可能: ${isAvailable}`);
      
      // 結果をキャッシュに保存
      cache.set(cacheKey, isAvailable);
      
      return isAvailable;
    }
    
    return false;
  } catch (error) {
    console.error(`[ERROR] 解答状態確認エラー: ${error.message}`);
    return false;
  }
}

// 解答表示フラグを設定する関数（自動遷移用）
async function markAnswerAsDisplayed(quizId) {
  try {
    // 共通の処理だけ抽出
    // キャッシュに値を設定（キャッシュファーストに）
    const cacheKey = `answer_displayed_${quizId}`;
    cache.set(cacheKey, true);
    
    // 以下はバックグラウンドで実行（Promiseを返さない）
    processAnswerDisplayed(quizId).catch(err => {
      console.error(`バックグラウンド処理中のエラー: ${err.message}`);
    });
    
    // すぐに成功を返す（DB操作の完了を待たない）
    return true;
  } catch (error) {
    console.error(`クイズ ${quizId} の解答表示フラグ更新中にエラーが発生しました:`, error);
    return false;
  }
}

// バックグラウンドでDB処理を行う関数
async function processAnswerDisplayed(quizId) {
  try {
    const queryParams = {
      TableName: TABLES.SESSION,
      IndexName: 'quiz_id-index', 
      KeyConditionExpression: 'quiz_id = :quizId',
      FilterExpression: 'attribute_not_exists(ended_at)',
      ExpressionAttributeValues: {
        ':quizId': quizId.toString()
      },
      ScanIndexForward: false,
      Limit: 1
    };
    
    const result = await dynamodb.send(new QueryCommand(queryParams));
    
    if (result.Items && result.Items.length > 0) {
      const session = result.Items[0];
      
      const updateParams = {
        TableName: TABLES.SESSION,
        Key: { 
          quiz_id: session.quiz_id,
          started_at: session.started_at
        },
        UpdateExpression: 'set answer_displayed = :displayed',
        ExpressionAttributeValues: {
          ':displayed': true
        }
      };
      
      await dynamodb.send(new UpdateCommand(updateParams));
      console.log(`クイズ ${quizId} の解答表示フラグを設定しました`);
    } else {
      console.warn(`クイズ ${quizId} の進行中セッションが見つかりませんでした`);
    }
  } catch (error) {
    console.error(`DB更新エラー: ${error.message}`);
    throw error; // 呼び出し元でキャッチされる
  }
}

// すべてのデータをリセット
async function resetAllData() {
  try {
    console.log('データのリセットを開始します...');
    
    // キャッシュをクリア
    cache.flushAll();
    
    // セッションデータを削除
    const sessionParams = {
      TableName: TABLES.SESSION
    };
    
    const sessionResult = await dynamodb.send(new ScanCommand(sessionParams));
    const sessions = sessionResult.Items || [];
    
    for (const session of sessions) {
      const params = {
        TableName: TABLES.SESSION,
        Key: {
          quiz_id: session.quiz_id,
          started_at: session.started_at
        }
      };
      
      await dynamodb.send(new DeleteCommand(params));
    }
    
    // 回答データを削除
    const answerParams = {
      TableName: TABLES.ANSWER
    };
    
    const answerResult = await dynamodb.send(new ScanCommand(answerParams));
    const answers = answerResult.Items || [];
    
    for (const answer of answers) {
      const params = {
        TableName: TABLES.ANSWER,
        Key: {
          player_id: answer.player_id,
          quiz_id: answer.quiz_id
        }
      };
      
      await dynamodb.send(new DeleteCommand(params));
    }
    
    // プレイヤーデータを削除
    const playerParams = {
      TableName: TABLES.PLAYER
    };
    
    const playerResult = await dynamodb.send(new ScanCommand(playerParams));
    const players = playerResult.Items || [];
    
    for (const player of players) {
      const params = {
        TableName: TABLES.PLAYER,
        Key: {
          id: player.id
        }
      };
      
      await dynamodb.send(new DeleteCommand(params));
    }
    
    // クイズ5の回答をリセット
    const updateParams = {
      TableName: TABLES.QUIZ,
      Key: { id: '5' },
      UpdateExpression: 'set correct_answer = :answer',
      ExpressionAttributeValues: {
        ':answer': ''
      }
    };
    
    await dynamodb.send(new UpdateCommand(updateParams));
    
    console.log('すべてのデータがリセットされました');
    return true;
  } catch (error) {
    console.error('データリセット中にエラーが発生しました:', error);
    return false;
  }
}

// データベース接続を閉じる（AWS SDK v3ではリソース解放は自動的に行われる）
function closeDb() {
  console.log('DynamoDB接続をクリーンアップします');
  // 何もする必要はありません
}

module.exports = {
  dynamodb,
  TABLES,
  initDb,
  closeDb,
  setQuiz5Answer,
  getQuiz,
  getAllQuizzes,
  startQuizSession,
  registerPlayer,
  getPlayer,
  recordAnswer,
  getPlayerAnswers,
  getQuizStats,
  getParticipantCount,
  getRankings,
  resetAllData,
  isQuizAnswerAvailable,
  markAnswerAsDisplayed,
  processAnswerDisplayed
};