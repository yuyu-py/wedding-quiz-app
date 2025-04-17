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
  phase: null, // 'title', 'question', 'practice', 'answer'など
  timerExpired: false,
  timerStartTime: 0,      // 開始時刻（正確なUTCミリ秒）
  timerEndTime: 0,        // 終了時刻（正確なUTCミリ秒）
  timerDuration: 30,      // 30秒固定
  activeTimerId: null,    // タイマーID管理用
  lastSyncTime: 0         // 最後の同期時刻
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
            const now = Date.now();
            const elapsed = now - currentQuizState.timerStartTime;
            const remaining = Math.max(0, currentQuizState.timerEndTime - now);
            const remainingTime = Math.ceil(remaining / 1000);
            
            socket.emit('precise_timer_sync', {
              quizId: currentQuizState.quizId,
              remaining: remaining,
              serverTime: now
            });
          }
        } else if (currentQuizState.phase === 'practice') {
          // 実践待機画面の場合
          socket.emit('quiz_event', { 
            event: 'show_practice',
            quizId: currentQuizState.quizId
          });
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
            timerEndTime: 0,
            timerDuration: 30,
            activeTimerId: null,
            lastSyncTime: 0
          };
          
          console.log(`クイズが開始されました`);
          break;
          
        case 'show_question':
          // 既存のタイマーをクリア
          stopQuizTimer();
          
          // 問題表示をブロードキャスト
          io.emit('quiz_event', { 
            event: 'show_question', 
            quizId,
            resetTimer: true
          });
          
          // クイズ状態を更新
          currentQuizState = {
            quizId,
            phase: 'title', // 最初はタイトルフェーズ
            timerExpired: false,
            timerStartTime: 0,
            timerEndTime: 0,
            timerDuration: 30,
            activeTimerId: null,
            lastSyncTime: 0
          };
          
          console.log(`クイズ ${quizId} のタイトルが表示されました - タイマーリセット完了`);
          break;
          
        case 'next_slide':
          // 現在のフェーズを確認
          if (currentQuizState.phase === 'title') {
            // タイトル画面から問題画面への遷移の場合
            
            // 遷移タイムスタンプを作成（少し先の時間）
            const transitionTime = Date.now() + 500; // 500ms後
            
            // 遷移イベントを送信
            io.emit('synchronized_transition', {
              quizId: currentQuizState.quizId,
              target: 'question',
              transitionTime: transitionTime, // 同期遷移時刻
              serverTime: Date.now()          // 現在のサーバー時刻
            });
            
            // タイマー開始準備
            setTimeout(() => {
              // タイマー開始
              startPreciseQuizTimer(currentQuizState.quizId);
              currentQuizState.phase = 'question';
            }, 700); // 遷移完了するまで余裕を持って待機
          } else if (currentQuizState.phase === 'practice') {
            // 問題5で実践画面表示中の場合は解答画面への移行
            currentQuizState.phase = 'answer';
            
            // 解答表示をブロードキャスト
            io.emit('quiz_event', { 
              event: 'show_answer', 
              quizId: currentQuizState.quizId,
              manual: true
            });
            
            // 強制遷移通知も送信
            io.emit('force_transition', {
              quizId: currentQuizState.quizId,
              target: 'answer',
              timestamp: Date.now()
            });
            
            // セッションの answer_displayed フラグを更新
            await db.markAnswerAsDisplayed(currentQuizState.quizId);
            
            console.log('問題5: 実践画面から解答画面に移行しました（手動）');
          } else {
            // その他の遷移（問題→答えなど）は通常通り処理
            io.emit('quiz_event', { 
              event: 'next_slide',
              manual: true
            });
          }
          
          console.log('管理者操作: 次のスライドに進みました');
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
          
        case 'prev_slide':
          // 前のスライドに戻る
          io.emit('quiz_event', { 
            event: 'prev_slide' 
          });
          
          // タイマーを停止（問題画面→タイトル画面に戻る場合）
          if (currentQuizState.phase === 'question') {
            stopQuizTimer();
            currentQuizState.phase = 'title';
          }
          
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
            timerEndTime: 0,
            timerDuration: 30,
            activeTimerId: null,
            lastSyncTime: 0
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
          
          // 問題5の場合は実践待機画面に遷移
          if (quizId === '5') {
            currentQuizState.phase = 'practice';
            
            io.emit('force_transition', {
              quizId,
              target: 'practice',
              timestamp: Date.now()
            });
            
            io.emit('quiz_event', { 
              event: 'show_practice', 
              quizId,
              auto: true
            });
            
            console.log(`問題5のタイマー終了: 実践待機画面に移行します`);
          } else {
            // 通常問題は解答画面に遷移
            currentQuizState.phase = 'answer';
            
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
            
            // セッションの answer_displayed フラグを更新
            await db.markAnswerAsDisplayed(quizId);
            
            console.log(`タイマー終了により、クイズ ${quizId} の解答が自動表示されました`);
          }
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
  
  // 正確なタイマー開始関数
  function startPreciseQuizTimer(quizId) {
    // 既存のタイマーをクリア
    stopQuizTimer();
    
    console.log(`サーバー: 正確なタイマー開始: クイズID ${quizId}`);
    
    // 正確な開始・終了時刻を設定
    const startTime = Date.now();
    const endTime = startTime + (currentQuizState.timerDuration * 1000);
    
    currentQuizState.timerStartTime = startTime;
    currentQuizState.timerEndTime = endTime;
    currentQuizState.lastSyncTime = startTime;
    
    // タイマー開始イベントを全クライアントに送信
    io.emit('precise_timer_start', {
      quizId,
      startTime,
      endTime,
      duration: currentQuizState.timerDuration,
      serverTime: startTime  // サーバー時刻の基準点
    });
    
    // 高頻度同期 - 最初の10秒間は頻繁に同期
    const highFreqSyncInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - currentQuizState.timerStartTime;
      const remaining = Math.max(0, currentQuizState.timerEndTime - now);
      
      // 1秒以上経過している場合のみ同期（短すぎる間隔での同期を防止）
      if (now - currentQuizState.lastSyncTime >= 1000) {
        io.emit('precise_timer_sync', {
          quizId,
          remaining,
          serverTime: now
        });
        currentQuizState.lastSyncTime = now;
      }
      
      // 10秒経過または残り時間なしで高頻度同期を終了
      if (elapsed > 10000 || remaining <= 0) {
        clearInterval(highFreqSyncInterval);
      }
    }, 1000); // 1秒間隔で同期
    
    // 通常同期 - 残りの時間は通常頻度で同期
    const normalSyncInterval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, currentQuizState.timerEndTime - now);
      
      // 2秒以上経過している場合のみ同期
      if (now - currentQuizState.lastSyncTime >= 2000) {
        io.emit('precise_timer_sync', {
          quizId,
          remaining,
          serverTime: now
        });
        currentQuizState.lastSyncTime = now;
      }
      
      // タイマー終了でクリア
      if (remaining <= 0) {
        clearInterval(normalSyncInterval);
        handleTimerExpiration(quizId);
      }
    }, 2000); // 2秒間隔で同期
    
    // タイマー終了処理の設定
    const timerId = setTimeout(() => {
      clearInterval(highFreqSyncInterval);
      clearInterval(normalSyncInterval);
      handleTimerExpiration(quizId);
    }, currentQuizState.timerDuration * 1000);
    
    // タイマーIDを保存
    currentQuizState.activeTimerId = {
      timer: timerId,
      highFreqInterval: highFreqSyncInterval,
      normalInterval: normalSyncInterval
    };
  }
  
  // タイマー終了の処理関数
  async function handleTimerExpiration(quizId) {
    console.log(`サーバー: クイズ ${quizId} タイマー終了`);
    
    // タイマー終了フラグを設定
    currentQuizState.timerExpired = true;
    
    // 問題5（ストップウォッチ問題）の場合は特別処理
    if (quizId === '5') {
      currentQuizState.phase = 'practice';
      io.emit('force_transition', {
        quizId,
        target: 'practice',
        timestamp: Date.now()
      });
      io.emit('quiz_event', { 
        event: 'show_practice', 
        quizId,
        auto: true
      });
    } else {
      // 通常問題の場合は解答表示へ
      currentQuizState.phase = 'answer';
      io.emit('force_transition', {
        quizId,
        target: 'answer',
        timestamp: Date.now()
      });
      io.emit('quiz_event', { 
        event: 'show_answer', 
        quizId,
        auto: true
      });
      
      // 解答表示フラグをDBに記録
      const db = require('../database/db');
      try {
        await db.markAnswerAsDisplayed(quizId);
      } catch (err) {
        console.error('解答表示フラグの更新中にエラーが発生しました:', err);
      }
    }
  }
  
  // タイマー停止関数
  function stopQuizTimer() {
    if (currentQuizState.activeTimerId) {
      if (currentQuizState.activeTimerId.timer) {
        clearTimeout(currentQuizState.activeTimerId.timer);
      }
      if (currentQuizState.activeTimerId.highFreqInterval) {
        clearInterval(currentQuizState.activeTimerId.highFreqInterval);
      }
      if (currentQuizState.activeTimerId.normalInterval) {
        clearInterval(currentQuizState.activeTimerId.normalInterval);
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