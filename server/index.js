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

// サーバーの初期設定
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
