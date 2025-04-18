// server/index.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./database/db');
const quizRoutes = require('./routes/quiz');
const adminRoutes = require('./routes/admin');
const playerRoutes = require('./routes/player');
const { setupSocketHandlers } = require('./socket/socketHandler');
const NodeCache = require('node-cache');

// サーバーの初期設定
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // 60秒のpingタイムアウト
  pingInterval: 25000  // 25秒ごとにping
});

// グローバルアプリケーション状態キャッシュ
const appStateCache = new NodeCache();

// 初期状態を設定
appStateCache.set('currentState', {
  screen: 'welcome',
  quizId: null,
  phase: null,
  rankingPosition: null,
  lastUpdate: Date.now()
});

// 状態更新関数をグローバルにアクセス可能にする
global.updateAppState = (newState) => {
  const currentState = appStateCache.get('currentState') || {};
  const updatedState = {
    ...currentState,
    ...newState,
    lastUpdate: Date.now()
  };
  appStateCache.set('currentState', updatedState);
  console.log(`アプリ状態更新: ${JSON.stringify(updatedState)}`);
  return updatedState;
};

// 状態取得関数
global.getAppState = () => {
  return appStateCache.get('currentState') || {
    screen: 'welcome',
    quizId: null,
    phase: null,
    rankingPosition: null,
    lastUpdate: Date.now()
  };
};

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// データベースの初期化
initDb();

// Socket.io ハンドラーのセットアップ
setupSocketHandlers(io);

// ルートの設定
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/player', playerRoutes);

// 接続状態表示用のCSSを定義
app.get('/css/connection-status.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.send(`
    #connection-status-indicator {
      position: fixed;
      bottom: 10px;
      left: 10px;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: opacity 0.5s;
    }
    
    @keyframes blink {
      0% { opacity: 0.3; }
      50% { opacity: 1; }
      100% { opacity: 0.3; }
    }
  `);
});

// メイン画面、管理画面、参加者画面のルート
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/display.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/play/:id?', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/player.html'));
});

// その他のリクエストはプレイヤーページにリダイレクト
app.get('*', (req, res) => {
  res.redirect('/play');
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバーが起動しました。ポート: ${PORT}`);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
  console.log('アプリケーションを終了します');
  process.exit(0);
});