const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 環境変数からデータベース接続情報を取得、または開発用デフォルト値を使用
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/quizapp',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// データベース初期化
async function initDb() {
  const client = await pool.connect();
  try {
    // トランザクション開始
    await client.query('BEGIN');

    // quizテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        question_image_path TEXT,
        answer_image_path TEXT,
        is_image_options BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // playerテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS player (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // answerテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS answer (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL,
        quiz_id INTEGER NOT NULL,
        answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        response_time INTEGER NOT NULL,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES player(id),
        FOREIGN KEY (quiz_id) REFERENCES quiz(id)
      )
    `);
    
    // quiz_sessionテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_session (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        custom_answer TEXT,
        FOREIGN KEY (quiz_id) REFERENCES quiz(id)
      )
    `);
    
    // インデックスの作成
    await client.query('CREATE INDEX IF NOT EXISTS idx_player_id ON answer (player_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quiz_id ON answer (quiz_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quiz_session_quiz_id ON quiz_session (quiz_id)');
    
    // サンプルクイズの追加（存在しない場合のみ）
    const quizCount = await client.query('SELECT COUNT(*) as count FROM quiz');
    
    if (parseInt(quizCount.rows[0].count) === 0) {
      // クイズ1: 記号の法則
      await client.query(`
        INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        '下記の記号の法則を見つけ、?に入るものを選択しろ。',
        JSON.stringify(['UCC', 'USJ', 'URL', 'USA']),
        'USA',
        '答えはUSAです。U○○の形式で、国や組織の略称になっています。',
        '/images/quiz-images/quiz1_question.png',
        '/images/quiz-images/quiz1_answer.png'
      ]);
      
      // クイズ2: 中国語のキャラクター
      await client.query(`
        INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        '下記の中国語で表されるキャラクターは？',
        JSON.stringify(['ピカチュウ(Pokemon)', 'ジェリー(Tom and Jerry)', 'ミッキーマウス(Disney)', 'ハム太郎(とっとこハム太郎)']),
        'ミッキーマウス(Disney)',
        '答えはミッキーマウスです。中国語では「米老鼠」と表記されます。',
        '/images/quiz-images/quiz2_question.png',
        '/images/quiz-images/quiz2_answer.png'
      ]);
      
      // クイズ3: 合成写真（画像選択肢）
      await client.query(`
        INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path, is_image_options)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        '新婦が作成した合成写真はどちらでしょう？',
        JSON.stringify([
          '/images/quiz-images/quiz3_option1.jpg', 
          '/images/quiz-images/quiz3_option2.JPG', 
          '/images/quiz-images/quiz3_option3.JPG', 
          '/images/quiz-images/quiz3_option4.jpg'
        ]),
        '2',
        '新郎が新婦の生誕10000日のためにタルトを作って蝋燭を立てたが、0を一個買い忘れたので合成してくれた',
        '',
        '',
        true
      ]);
      
      // クイズ4: 新郎の冤罪（画像選択肢）
      await client.query(`
        INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path, is_image_options)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        '新郎が疑いをかけられた冤罪とは？',
        JSON.stringify([
          '/images/quiz-images/quiz4_option1.png',
          '/images/quiz-images/quiz4_option2.png',
          '/images/quiz-images/quiz4_option3.png',
          '/images/quiz-images/quiz4_option4.png'
        ]),
        '3',
        '私は優柔不断で、スーパーでお菓子を何にしようか決められず、30分ほどうろうろと商品を手に取ったり戻したりを繰り返していました。この不審な様子からGメンに声をかけられましたが、カバンの中身を確認してもらい、無実が証明されました。',
        '',
        '/images/quiz-images/quiz4_answer.png',
        true
      ]);
      
      // クイズ5: ストップウォッチ
      await client.query(`
        INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'ストップウォッチ15秒に近く止められるのはどっち？',
        JSON.stringify(['新郎', '新婦']),
        '',
        '実際に計測した結果です。',
        '',
        ''
      ]);
    }
    
    // トランザクション確定
    await client.query('COMMIT');
    
    console.log('データベースの初期化が完了しました');
  } catch (error) {
    // エラー発生時はロールバック
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// クイズ5の答えを設定
async function setQuiz5Answer(answer) {
  try {
    const client = await pool.connect();
    try {
      // クイズ5の正解を更新
      await client.query('UPDATE quiz SET correct_answer = $1 WHERE id = 5', [answer]);
      
      // 現在のセッションに答えを記録
      await client.query(`
        UPDATE quiz_session 
        SET custom_answer = $1 
        WHERE quiz_id = 5 AND ended_at IS NULL
      `, [answer]);
      
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('クイズ5の答え設定中にエラーが発生しました:', error);
    return false;
  }
}

// データベースクエリを実行
async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// 全てのリソースをクリーンアップ
async function closeDb() {
  await pool.end();
}

module.exports = {
  query,
  initDb,
  closeDb,
  setQuiz5Answer
};
