// server/socket/socketHandler.js
const { getDb } = require('../database/db');

// ソケット接続の管理
let activeConnections = {
  display: null, // メイン表示用の接続
  admin: [],     // 管理者用の接続
  players: {}    // プレイヤー用の接続 (player_id: socket)
};

// アクティブな接続数のカウント
let connectionCounter = {
  total: 0,
  players: 0,
  admin: 0  // 管理者数をカウントするために追加
};

// 現在のクイズ状態を追跡
let currentQuizState = {
  quizId: null,
  phase: null, // 'question', 'answer'など
  timerExpired: false,
  timerStartTime: 0,
  timerDuration: 30, // 30秒固定
  activeTimerId: null // タイマーID管理用
};

function setupSocketHandlers(io) {
  // グローバル変数にioを保存（ブロードキャスト用）
  global.io = io;
  
  io.on('connection', (socket) => {
    console.log(`新しい接続: ${socket.id}`);
    connectionCounter.total++;
    
    // 接続タイプの登録
    socket.on('register', (data) => {
      const { type, playerId = null } = data;
      
      // 接続タイプに応じた処理
      switch (type) {
        case 'display':
          // 1つのディスプレイ接続のみ許可
          if (activeConnections.display) {
            // 古い接続を切断
            const oldSocket = activeConnections.display;
            oldSocket.emit('connection_rejected', { reason: '新しいディスプレイ接続がありました' });
          }
          activeConnections.display = socket;
          socket.emit('registered', { type });
          console.log('ディスプレイ接続が登録されました');
          
          // 最新の接続状態を送信
          broadcastConnectionStats();
          break;
          
        case 'admin':
          activeConnections.admin.push(socket);
          connectionCounter.admin++; // 管理者カウントを増加
          socket.emit('registered', { type });
          
          // 現在の接続状態を送信
          socket.emit('connection_stats', {
            total: connectionCounter.total,
            players: connectionCounter.players,
            admin: connectionCounter.admin
          });
          
          // 生の統計データも送信
          socket.emit('connection_stats_raw', {
            total: connectionCounter.total,
            players: connectionCounter.players,
            admin: connectionCounter.admin
          });
          
          console.log('管理者接続が登録されました - 合計:', connectionCounter.admin);
          break;
          
        case 'player':
          if (!playerId) {
            socket.emit('registration_error', { message: 'プレイヤーIDが必要です' });
            return;
          }
          
          activeConnections.players[playerId] = socket;
          connectionCounter.players++;
          
          socket.emit('registered', { type, playerId });
          
          // プレイヤー数の更新を全体に通知
          broadcastConnectionStats();
          
          console.log(`プレイヤー接続が登録されました: ${playerId} - 合計:`, connectionCounter.players);
          break;
          
        default:
          socket.emit('registration_error', { message: '不明な接続タイプです' });
      }
      
      // 現在のクイズ状態に応じて必要な情報を送信
      if (currentQuizState.quizId && currentQuizState.phase) {
        // 既に進行中のクイズがある場合は現在の状態を通知
        if (currentQuizState.phase === 'answer') {
          socket.emit('quiz_event', { 
            event: 'show_answer',
            quizId: currentQuizState.quizId
          });
        } else if (currentQuizState.phase === 'question') {
          socket.emit('quiz_event', { 
            event: 'show_question',
            quizId: currentQuizState.quizId
          });
          
          // タイマーが既に切れていれば通知
          if (currentQuizState.timerExpired) {
            socket.emit('timer_expired', { quizId: currentQuizState.quizId });
          } else if (currentQuizState.timerStartTime > 0) {
            // タイマー進行中なら残り時間を計算して同期
            const elapsed = Date.now() - currentQuizState.timerStartTime;
            const remainingTime = Math.max(0, Math.floor((currentQuizState.timerDuration * 1000 - elapsed) / 1000));
            
            socket.emit('timer_sync', {
              quizId: currentQuizState.quizId,
              remainingTime
            });
          }
        }
      }
    });
    
    // クイズ制御コマンド（管理者用）
    socket.on('quiz_command', async (data) => {
      const { command, quizId, params = {} } = data;
      
      // 管理者かどうか確認
      if (!activeConnections.admin.includes(socket)) {
        socket.emit('command_error', { message: '権限がありません' });
        return;
      }
      
      const db = require('../database/db');
      
      switch (command) {
        case 'start_quiz':
          // クイズの開始をブロードキャスト
          io.emit('quiz_event', { 
            event: 'quiz_started' 
          });
          
          // クイズ状態をリセット
          currentQuizState = {
            quizId: null,
            phase: null,
            timerExpired: false,
            timerStartTime: 0,
            timerDuration: 30,
            activeTimerId: null
          };
          
          console.log(`クイズが開始されました`);
          break;
          
        case 'show_question':
          // 問題表示をブロードキャスト
          io.emit('quiz_event', { 
            event: 'show_question', 
            quizId 
          });
          
          // クイズ状態を更新
          currentQuizState = {
            quizId,
            phase: 'question',
            timerExpired: false,
            timerStartTime: Date.now(),
            timerDuration: 30,
            activeTimerId: null
          };
          
          // サーバー側タイマーの開始
          startQuizTimer(quizId);
          
          console.log(`クイズ ${quizId} の問題が表示されました - タイマー開始`);
          break;
          
        case 'show_answer':
          // 解答表示をブロードキャスト
          io.emit('quiz_event', { 
            event: 'show_answer', 
            quizId,
            manual: true // 手動操作フラグ
          });
          
          // タイマーを停止
          stopQuizTimer();
          
          // クイズ状態を更新
          currentQuizState.phase = 'answer';
          currentQuizState.timerExpired = true;
          
          // セッションの answer_displayed フラグを更新
          await db.markAnswerAsDisplayed(quizId);
          
          console.log(`クイズ ${quizId} の解答が表示されました（手動）`);
          break;
          
        case 'show_ranking':
          // ランキング表示をブロードキャスト
          io.emit('quiz_event', { 
            event: 'show_ranking',
            position: params.position || 'all'
          });
          
          console.log(`ランキングが表示されました: ${params.position || 'all'}`);
          break;
          
        case 'next_slide':
          // 次のスライドに進む
          io.emit('quiz_event', { 
            event: 'next_slide',
            manual: true // 手動遷移フラグ
          });
          console.log('管理者操作: 次のスライドに進みました');
          break;
          
        case 'prev_slide':
          // 前のスライドに戻る
          io.emit('quiz_event', { 
            event: 'prev_slide' 
          });
          console.log('前のスライドに戻りました');
          break;
          
        case 'reset_all':
          // タイマーを停止
          stopQuizTimer();
          
          // リセットコマンドを送信
          io.emit('quiz_event', {
            event: 'reset_all'
          });
          
          // クイズ状態をリセット
          currentQuizState = {
            quizId: null,
            phase: null,
            timerExpired: false,
            timerStartTime: 0,
            timerDuration: 30,
            activeTimerId: null
          };
          
          console.log('すべてのデータがリセットされました');
          break;
          
        default:
          socket.emit('command_error', { message: '不明なコマンドです' });
      }
    });
    
    // タイマー終了時のイベント
    socket.on('timer_expired', async (data) => {
      const { quizId } = data;
      
      // タイマー終了状態を更新
      if (currentQuizState.quizId === quizId && currentQuizState.phase === 'question') {
        currentQuizState.timerExpired = true;
        
        // ディスプレイから発信された場合のみ、全員に通知
        if (socket === activeConnections.display) {
          console.log(`クイズ ${quizId} のタイマーが終了しました - 自動的に解答表示に移行します`);
          
          // 強制遷移通知を送信
          io.emit('force_transition', {
            quizId,
            target: 'answer',
            timestamp: Date.now()
          });
          
          // 解答表示をブロードキャスト
          io.emit('quiz_event', { 
            event: 'show_answer', 
            quizId,
            auto: true // 自動遷移フラグ
          });
          
          // クイズ状態を更新
          currentQuizState.phase = 'answer';
          
          // セッションの answer_displayed フラグを更新
          const db = require('../database/db');
          await db.markAnswerAsDisplayed(quizId);
          
          console.log(`タイマー終了により、クイズ ${quizId} の解答が自動表示されました`);
        }
      }
    });
    
    // 回答イベント（プレイヤー用）
    socket.on('submit_answer', (data) => {
      const { playerId, quizId, answer } = data;
      
      // プレイヤー登録確認
      let isRegisteredPlayer = false;
      Object.entries(activeConnections.players).forEach(([id, s]) => {
        if (s === socket && id === playerId) {
          isRegisteredPlayer = true;
        }
      });
      
      if (!isRegisteredPlayer) {
        socket.emit('answer_error', { message: '登録されていないプレイヤーです' });
        return;
      }
      
      // 回答をデータベースに記録（APIで処理するので通知のみ）
      io.emit('answer_submitted', {
        playerId,
        quizId
      });
      
      // 管理者に回答状況を通知
      activeConnections.admin.forEach(adminSocket => {
        adminSocket.emit('answer_update', {
          playerId,
          quizId,
          answer
        });
      });
    });
    
    // ホーム画面に戻る
    socket.on('go_home', () => {
      socket.emit('go_home_event');
    });
    
    // 切断時の処理
    socket.on('disconnect', () => {
      console.log(`接続が切断されました: ${socket.id}`);
      connectionCounter.total--;
      
      // 接続リストから削除
      if (activeConnections.display === socket) {
        activeConnections.display = null;
        console.log('ディスプレイ接続が切断されました');
      }
      
      const adminIndex = activeConnections.admin.indexOf(socket);
      if (adminIndex !== -1) {
        activeConnections.admin.splice(adminIndex, 1);
        connectionCounter.admin--; // 管理者カウントを減少
        console.log('管理者接続が切断されました - 残り:', connectionCounter.admin);
        broadcastConnectionStats(); // 更新を通知
      }
      
      let playerIdToRemove = null;
      Object.entries(activeConnections.players).forEach(([playerId, s]) => {
        if (s === socket) {
          playerIdToRemove = playerId;
        }
      });
      
      if (playerIdToRemove) {
        delete activeConnections.players[playerIdToRemove];
        connectionCounter.players--;
        console.log(`プレイヤー接続が切断されました: ${playerIdToRemove} - 残り:`, connectionCounter.players);
        broadcastConnectionStats();
      }
    });
  });
  
  // サーバー側タイマー機能の実装
  function startQuizTimer(quizId) {
    // 既存のタイマーをクリア
    stopQuizTimer();
    
    console.log(`サーバー側タイマー開始: クイズID ${quizId} - ${currentQuizState.timerDuration}秒`);
    
    // タイマー開始時刻を記録
    currentQuizState.timerStartTime = Date.now();
    
    // 1秒ごとの同期処理
    const syncInterval = setInterval(() => {
      // 経過時間の計算
      const elapsed = Date.now() - currentQuizState.timerStartTime;
      const remainingTime = Math.max(0, Math.floor((currentQuizState.timerDuration * 1000 - elapsed) / 1000));
      
      // クライアントへタイマー情報を送信
      io.emit('timer_sync', {
        quizId,
        remainingTime
      });
      
      // デバッグ（10秒ごとに残り時間をログ出力）
      if (remainingTime % 10 === 0 && remainingTime > 0) {
        console.log(`クイズ ${quizId} タイマー: 残り ${remainingTime}秒`);
      }
    }, 1000);
    
    // タイマー終了時の処理（厳密な終了時間を設定）
    const timerDuration = currentQuizState.timerDuration * 1000; // ミリ秒に変換
    const timerId = setTimeout(() => {
      console.log(`クイズ ${quizId} タイマー終了: ${currentQuizState.timerDuration}秒経過`);
      
      // 同期タイマーを停止
      clearInterval(syncInterval);
      
      // タイマー終了フラグを設定
      currentQuizState.timerExpired = true;
      currentQuizState.phase = 'answer';
      
      // 重要: 全クライアントに強制的に画面遷移を指示
      io.emit('force_transition', {
        quizId,
        target: 'answer',
        timestamp: Date.now()
      });
      
      // 従来の互換性のためのイベントも送信
      io.emit('quiz_event', { 
        event: 'show_answer', 
        quizId,
        auto: true
      });
      
      // 解答表示フラグをデータベースに記録
      const db = require('../database/db');
      db.markAnswerAsDisplayed(quizId)
        .then(() => {
          console.log(`タイマー終了: クイズ ${quizId} の解答表示フラグを設定しました`);
        })
        .catch(err => {
          console.error('解答表示フラグの更新中にエラーが発生しました:', err);
        });
      
      currentQuizState.activeTimerId = null;
    }, timerDuration);
    
    // タイマーIDを保存
    currentQuizState.activeTimerId = {
      timer: timerId,
      interval: syncInterval
    };
  }
  
  // タイマー停止関数
  function stopQuizTimer() {
    if (currentQuizState.activeTimerId) {
      if (currentQuizState.activeTimerId.timer) {
        clearTimeout(currentQuizState.activeTimerId.timer);
      }
      if (currentQuizState.activeTimerId.interval) {
        clearInterval(currentQuizState.activeTimerId.interval);
      }
      currentQuizState.activeTimerId = null;
      console.log('サーバー側タイマーを停止しました');
    }
  }
}

// 接続統計をブロードキャスト
function broadcastConnectionStats() {
  const io = global.io;
  if (!io) return;
  
  // プレイヤー数から管理者分を差し引かない生の数値
  const rawStats = {
    total: connectionCounter.total,
    players: connectionCounter.players,
    admin: connectionCounter.admin
  };
  
  // 管理者に生の数値を送信（デバッグ用）
  activeConnections.admin.forEach(socket => {
    socket.emit('connection_stats_raw', rawStats);
  });
  
  // ディスプレイ用の調整された数値（運営者を除く）
  const displayStats = {
    players: connectionCounter.players, // そのままのプレイヤー数
    displayCount: Math.max(0, connectionCounter.players) // 表示用カウント
  };
  
  // ディスプレイに送信
  if (activeConnections.display) {
    activeConnections.display.emit('connection_stats', displayStats);
  }
}

module.exports = {
  setupSocketHandlers
};