// server/database/db.js
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

// Cache setup (60 seconds)
const cache = new NodeCache({ stdTTL: 60 });

// DynamoDB client setup
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1'
  // AWS credentials will be automatically loaded from ~/.aws/credentials
});

// DynamoDB document client
const dynamodb = DynamoDBDocumentClient.from(client);

// Table name prefix
const tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || 'wedding_quiz_';

// Table names definition
const TABLES = {
  QUIZ: `${tablePrefix}quiz`,
  PLAYER: `${tablePrefix}player`,
  ANSWER: `${tablePrefix}answer`,
  SESSION: `${tablePrefix}session`
};

// Initialize DynamoDB
async function initDb() {
  console.log('Initializing DynamoDB connection...');
  
  try {
    // Check and add sample quiz data
    const quizCount = await countQuizItems();
    console.log(`Existing quiz data: ${quizCount} items`);
    
    if (quizCount === 0) {
      await insertSampleQuizData();
      console.log('Sample quiz data added');
    }
    
    console.log('DynamoDB connection initialization completed');
  } catch (error) {
    console.error('Error during DynamoDB initialization:', error);
  }
}

// Get quiz item count
async function countQuizItems() {
  try {
    const params = {
      TableName: TABLES.QUIZ,
      Select: 'COUNT'
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    return result.Count;
  } catch (error) {
    console.error('Error retrieving quiz count:', error);
    return 0;
  }
}

// Insert sample quiz data
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
  
  console.log('Starting sample quiz data insertion...');
  
  // Insert one by one
  for (const item of quizItems) {
    const params = {
      TableName: TABLES.QUIZ,
      Item: item
    };
    
    try {
      await dynamodb.send(new PutCommand(params));
      console.log(`Quiz ${item.id} inserted`);
    } catch (error) {
      console.error(`Error inserting quiz ${item.id}:`, error);
      throw error;
    }
  }
}

// Set Quiz 5 answer
async function setQuiz5Answer(answer) {
  try {
    // Clear cache
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
    
    await dynamodb.send(new UpdateCommand(params));
    
    // Record custom answer in current session
    // Get the latest unfinished session
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
        
        await dynamodb.send(new UpdateCommand(updateParams));
      }
    } catch (error) {
      console.error('Error updating session information:', error);
      // Answer was still updated in the quiz, so return true
    }
    
    return true;
  } catch (error) {
    console.error('Error setting Quiz 5 answer:', error);
    return false;
  }
}

// Get a specific quiz
async function getQuiz(id) {
  const cacheKey = `quiz_${id}`;
  
  // Check cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
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
    
    // Save result to cache
    cache.set(cacheKey, result.Item);
    return result.Item;
  } catch (error) {
    console.error(`Error retrieving quiz ${id}:`, error);
    return null;
  }
}

// Get all quizzes
async function getAllQuizzes() {
  const cacheKey = 'all_quizzes';
  
  // Check cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  try {
    const params = {
      TableName: TABLES.QUIZ
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    
    // Save result to cache
    cache.set(cacheKey, result.Items);
    return result.Items;
  } catch (error) {
    console.error('Error retrieving all quizzes:', error);
    return [];
  }
}

// Start a quiz session
async function startQuizSession(quizId) {
  try {
    // End existing active sessions
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
    
    // Create new session
    const startedAt = new Date().toISOString();
    const createParams = {
      TableName: TABLES.SESSION,
      Item: {
        quiz_id: quizId.toString(),
        started_at: startedAt,
        custom_answer: null,
        answer_displayed: false,
        is_timer_expired: false
      }
    };
    
    await dynamodb.send(new PutCommand(createParams));
    
    return {
      success: true,
      sessionId: `${quizId}_${startedAt}`
    };
  } catch (error) {
    console.error(`Error starting quiz ${quizId} session:`, error);
    return {
      success: false,
      error: 'Error occurred while starting session'
    };
  }
}

// Register player
async function registerPlayer(id, name) {
  try {
    const params = {
      TableName: TABLES.PLAYER,
      Item: {
        id,
        name,
        joined_at: new Date().toISOString()
      }
    };
    
    await dynamodb.send(new PutCommand(params));
    return true;
  } catch (error) {
    console.error(`Error registering player ${id}:`, error);
    return false;
  }
}

// Get player information
async function getPlayer(id) {
  try {
    const params = {
      TableName: TABLES.PLAYER,
      Key: { id }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    return result.Item;
  } catch (error) {
    console.error(`Error retrieving player ${id}:`, error);
    return null;
  }
}

// Get participant count
async function getParticipantCount() {
  try {
    const params = {
      TableName: TABLES.PLAYER,
      Select: 'COUNT'
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    return result.Count;
  } catch (error) {
    console.error('Error retrieving participant count:', error);
    return 0;
  }
}

// Record answer
async function recordAnswer(playerId, quizId, answer, isCorrect, responseTime) {
  try {
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
    
    // Clear rankings cache
    cache.del('rankings');
    
    return true;
  } catch (error) {
    console.error(`Error recording answer for player ${playerId} quiz ${quizId}:`, error);
    return false;
  }
}

// Get player answers
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
    console.error(`Error retrieving answer history for player ${playerId}:`, error);
    return [];
  }
}

// Get quiz statistics
async function getQuizStats(quizId) {
  try {
    // Get quiz information
    const quiz = await getQuiz(quizId);
    if (!quiz) {
      return null;
    }
    
    const options = JSON.parse(quiz.options);
    
    // Get answers for this quiz
    const params = {
      TableName: TABLES.ANSWER,
      IndexName: 'quiz_id-index',
      KeyConditionExpression: 'quiz_id = :quizId',
      ExpressionAttributeValues: {
        ':quizId': quizId.toString()
      }
    };
    
    const answers = await dynamodb.send(new QueryCommand(params));
    
    // Count answers for each option
    const stats = options.map(option => {
      const count = answers.Items ? 
        answers.Items.filter(a => a.answer === option).length : 0;
      
      return {
        option,
        count,
        isCorrect: option === quiz.correct_answer
      };
    });
    
    // Total participants and correct answers
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
    console.error(`Error retrieving statistics for quiz ${quizId}:`, error);
    return null;
  }
}

// Get rankings
async function getRankings() {
  const cacheKey = 'rankings';
  
  // Check cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  try {
    // Get all players
    const playersParams = {
      TableName: TABLES.PLAYER
    };
    
    const playersResult = await dynamodb.send(new ScanCommand(playersParams));
    const players = playersResult.Items || [];
    
    // Collect data for ranking calculation
    const rankingData = [];
    
    for (const player of players) {
      // Get player's answers
      const answersParams = {
        TableName: TABLES.ANSWER,
        KeyConditionExpression: 'player_id = :playerId',
        ExpressionAttributeValues: {
          ':playerId': player.id
        }
      };
      
      const answersResult = await dynamodb.send(new QueryCommand(answersParams));
      const answers = answersResult.Items || [];
      
      // Calculate correct answers and total response time
      const correctCount = answers.filter(a => a.is_correct === 1).length;
      const totalTime = answers.reduce((sum, a) => sum + a.response_time, 0);
      
      rankingData.push({
        player_id: player.id,
        player_name: player.name,
        correct_count: correctCount,
        total_time: totalTime,
        quiz_count: answers.length
      });
    }
    
    // Sort by correct count (descending), then by response time (ascending)
    rankingData.sort((a, b) => {
      if (a.correct_count !== b.correct_count) {
        return b.correct_count - a.correct_count; // correct count descending
      }
      return a.total_time - b.total_time; // response time ascending
    });
    
    // Limit to top 30
    const limitedRankings = rankingData.slice(0, 30);
    
    // Save result to cache
    cache.set(cacheKey, limitedRankings);
    return limitedRankings;
  } catch (error) {
    console.error('Error retrieving rankings:', error);
    return [];
  }
}

// Check if quiz answer is available
async function isQuizAnswerAvailable(quizId) {
  try {
    // Get the latest session for this quiz ID
    const queryParams = {
      TableName: TABLES.SESSION,
      IndexName: 'quiz_id-index',
      KeyConditionExpression: 'quiz_id = :quizId',
      ExpressionAttributeValues: {
        ':quizId': quizId.toString()
      },
      ScanIndexForward: false, // descending (latest first)
      Limit: 1 // only the latest
    };
    
    const result = await dynamodb.send(new QueryCommand(queryParams));
    
    // If result exists and answer_displayed is true or is_timer_expired is true
    if (result.Items && result.Items.length > 0) {
      const session = result.Items[0];
      return session.answer_displayed === true || session.is_timer_expired === true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking answer availability for quiz ${quizId}:`, error);
    return false;
  }
}

// Mark quiz answer as displayed
async function markQuizAnswerDisplayed(quizId, displayed) {
  try {
    // Get the latest session
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
          ':displayed': displayed
        }
      };
      
      await dynamodb.send(new UpdateCommand(updateParams));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating answer display status for quiz ${quizId}:`, error);
    return false;
  }
}

// Mark quiz timer as expired
async function markQuizTimerExpired(quizId, expired) {
  try {
    // Get the latest session
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
        UpdateExpression: 'set is_timer_expired = :expired',
        ExpressionAttributeValues: {
          ':expired': expired
        }
      };
      
      await dynamodb.send(new UpdateCommand(updateParams));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating timer expiration status for quiz ${quizId}:`, error);
    return false;
  }
}

// Reset all data
async function resetAllData() {
  try {
    console.log('Starting data reset...');
    
    // Clear cache
    cache.flushAll();
    
    // Delete session data
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
    
    // Delete answer data
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
    
    // Delete player data
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
    
    // Reset Quiz 5 answer
    const updateParams = {
      TableName: TABLES.QUIZ,
      Key: { id: '5' },
      UpdateExpression: 'set correct_answer = :answer',
      ExpressionAttributeValues: {
        ':answer': ''
      }
    };
    
    await dynamodb.send(new UpdateCommand(updateParams));
    
    console.log('All data has been reset');
    return true;
  } catch (error) {
    console.error('Error during data reset:', error);
    return false;
  }
}

// Close database connection (with AWS SDK v3, resources are released automatically)
function closeDb() {
  console.log('Cleaning up DynamoDB connection');
  // Nothing to do
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
  getParticipantCount,
  recordAnswer,
  getPlayerAnswers,
  getQuizStats,
  getRankings,
  resetAllData,
  isQuizAnswerAvailable,
  markQuizAnswerDisplayed,
  markQuizTimerExpired
};