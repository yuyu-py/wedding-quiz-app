const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// データベースディレクトリの確認
const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// データベースファイルのパス
const dbPath = path.join(dbDir, 'quiz.db');

// データベース接続
let db;

function getDb() {
  if (!db) {
    db = new Database(dbPath, { verbose: console.log });
    // WALモードを有効にして同時接続のパフォーマンスを向上
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// データベース初期化
function initDb() {
  const db = getDb();
  
  // 外部キー制約を有効にする
  db.pragma('foreign_keys = ON');
  
  // quizテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      question_image_path TEXT,
      answer_image_path TEXT,
      is_image_options BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // playerテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS player (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // answerテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS answer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_session (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP,
      custom_answer TEXT,
      FOREIGN KEY (quiz_id) REFERENCES quiz(id)
    )
  `);
  
  // インデックスの作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_player_id ON answer (player_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_id ON answer (quiz_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_session_quiz_id ON quiz_session (quiz_id);
  `);
  
  // クイズデータがあるか確認
  const quizCount = db.prepare('SELECT COUNT(*) as count FROM quiz').get();
  
  if (quizCount.count === 0) {
    // クイズ1: 記号の法則
    db.prepare(`
      INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      '下記の記号の法則を見つけ、?に入るものを選択しろ。',
      JSON.stringify(['UCC', 'USJ', 'URL', 'USA']),
      'USA',
      '答えはUSAです。U○○の形式で、国や組織の略称になっています。',
      '/images/quiz-images/quiz1_question.png',
      '/images/quiz-images/quiz1_answer.png'
    );
    
    // クイズ2: 中国語のキャラクター
    db.prepare(`
      INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      '下記の中国語で表されるキャラクターは？',
      JSON.stringify(['ピカチュウ(Pokemon)', 'ジェリー(Tom and Jerry)', 'ミッキーマウス(Disney)', 'ハム太郎(とっとこハム太郎)']),
      'ミッキーマウス(Disney)',
      '答えはミッキーマウスです。中国語では「米老鼠」と表記されます。',
      '/images/quiz-images/quiz2_question.png',
      '/images/quiz-images/quiz2_answer.png'
    );
    
    // クイズ3: 合成写真（画像選択肢）
    db.prepare(`
      INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path, is_image_options)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '新婦が作成した合成写真はどちらでしょう？',
      JSON.stringify([
        '/images/quiz-images/quiz3_option1.jpg', 
        '/images/quiz-images/quiz3_option2.JPG', 
        '/images/quiz-images/quiz3_option3.JPG', 
        '/images/quiz-images/quiz3_option4.jpg'
      ]),
      '2',
      '新郎が新婦の生誕10000日のためにタルトを作って蝋燭を立てたが、0を一個買い忘れたので合成してくれた',
      '', // 選択肢自体が画像なので問題画像は不要
      '', // 特別なレイアウト処理をするのでここは空に
      1  // 画像選択肢フラグ
    );
    
    // クイズ4: 新郎の冤罪（画像選択肢）
    db.prepare(`
      INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path, is_image_options)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      '新郎が疑いをかけられた冤罪とは？',
      JSON.stringify([
        '/images/quiz-images/quiz4_option1.png', // 痴漢
        '/images/quiz-images/quiz4_option2.png', // 不法侵入
        '/images/quiz-images/quiz4_option3.png', // 万引き
        '/images/quiz-images/quiz4_option4.png'  // 器物損壊
      ]),
      '3', // 万引き（3番目の選択肢）
      '私は優柔不断で、スーパーでお菓子を何にしようか決められず、30分ほどうろうろと商品を手に取ったり戻したりを繰り返していました。この不審な様子からGメンに声をかけられましたが、カバンの中身を確認してもらい、無実が証明されました。',
      '',
      '/images/quiz-images/quiz4_answer.png',
      1  // 画像選択肢フラグ
    );
    
    // クイズ5: ストップウォッチ（当日回答設定タイプ）
    db.prepare(`
      INSERT INTO quiz (question, options, correct_answer, explanation, question_image_path, answer_image_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'ストップウォッチ15秒に近く止められるのはどっち？',
      JSON.stringify(['新郎', '新婦']),
      '', // 空の答え（当日設定）
      '実際に計測した結果です。', 
      '', // 問題画像なし
      '' // 解答画像なし - 特別なテキスト表示に
    );
    
    console.log('サンプルクイズデータを追加しました');
  }
  
  console.log('データベースの初期化が完了しました');
}

// クイズ5の答えを設定
function setQuiz5Answer(answer) {
  try {
    const db = getDb();
    
    // クイズ5の正解を更新
    db.prepare('UPDATE quiz SET correct_answer = ? WHERE id = 5').run(answer);
    
    // 現在のセッションに答えを記録
    db.prepare(`
      UPDATE quiz_session 
      SET custom_answer = ? 
      WHERE quiz_id = 5 AND ended_at IS NULL
    `).run(answer);
    
    return true;
  } catch (error) {
    console.error('クイズ5の答え設定中にエラーが発生しました:', error);
    return false;
  }
}

// データベース接続を閉じる
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  initDb,
  closeDb,
  setQuiz5Answer
};
