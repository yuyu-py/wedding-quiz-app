// グローバルなSocket.io接続管理
const SocketManager = {
    socket: null,
    connectionStatus: 'disconnected', // 'connected', 'disconnected', 'reconnecting'
    listeners: {},
    
    // 初期化
    init: function(options = {}) {
      // 既存のソケットがあれば切断
      if (this.socket) {
        this.socket.disconnect();
      }
      
      // 再接続設定を強化したSocket.io設定
      this.socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity, // 無限に再接続を試みる
        reconnectionDelay: 1000,        // 初回再接続遅延
        reconnectionDelayMax: 5000,     // 最大再接続遅延
        timeout: 10000,                 // 接続タイムアウト
        ...options
      });
      
      // 接続ステータスイベントのリスナー
      this.socket.on('connect', () => {
        console.log('Socket.io に接続しました');
        this.connectionStatus = 'connected';
        this._updateStatusUI();
        
        // 接続後に状態同期を要求
        this._syncState();
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log(`Socket.io が切断されました: ${reason}`);
        this.connectionStatus = 'disconnected';
        this._updateStatusUI();
      });
      
      this.socket.on('reconnecting', (attemptNumber) => {
        console.log(`Socket.io 再接続試行中 (${attemptNumber}回目)`);
        this.connectionStatus = 'reconnecting';
        this._updateStatusUI();
      });
      
      this.socket.on('reconnect', () => {
        console.log('Socket.io 再接続成功');
        this.connectionStatus = 'connected';
        this._updateStatusUI();
        
        // 再接続後に状態同期を要求
        this._syncState();
      });
      
      this.socket.on('reconnect_error', (error) => {
        console.error('Socket.io 再接続エラー:', error);
      });
      
      // アプリの状態更新イベント
      this.socket.on('app_state_update', (state) => {
        console.log('アプリケーション状態更新:', state);
        this._handleStateUpdate(state);
      });
      
      return this.socket;
    },
    
    // 状態更新に対するハンドラ登録
    onStateUpdate: function(callback) {
      this.listeners.stateUpdate = callback;
    },
    
    // アプリ状態を同期
    _syncState: function() {
      // サーバーから最新状態を取得
      fetch('/api/quiz/state')
        .then(response => response.json())
        .then(data => {
          if (data.success && data.state) {
            console.log('サーバーから状態を同期:', data.state);
            this._handleStateUpdate(data.state);
          }
        })
        .catch(error => {
          console.error('状態同期に失敗:', error);
        });
    },
    
    // 状態更新を処理
    _handleStateUpdate: function(state) {
      // 登録されたコールバックがあれば呼び出し
      if (this.listeners.stateUpdate) {
        this.listeners.stateUpdate(state);
      }
    },
    
    // UI更新（接続ステータスを表示）
    _updateStatusUI: function() {
      // ステータスインジケータを作成または更新
      let statusEl = document.getElementById('connection-status-indicator');
      
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'connection-status-indicator';
        document.body.appendChild(statusEl);
        
        // スタイル
        statusEl.style.position = 'fixed';
        statusEl.style.bottom = '10px';
        statusEl.style.left = '10px';
        statusEl.style.padding = '5px 10px';
        statusEl.style.borderRadius = '4px';
        statusEl.style.fontSize = '12px';
        statusEl.style.fontWeight = 'bold';
        statusEl.style.zIndex = '9999';
        statusEl.style.display = 'flex';
        statusEl.style.alignItems = 'center';
        statusEl.style.gap = '5px';
      }
      
      // ステータスに応じた表示内容
      if (this.connectionStatus === 'connected') {
        statusEl.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background-color:#4caf50;border-radius:50%;"></span> 接続中';
        statusEl.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
        statusEl.style.color = '#4caf50';
        
        // 2秒後に非表示
        setTimeout(() => {
          statusEl.style.opacity = '0';
          statusEl.style.transition = 'opacity 0.5s';
        }, 2000);
      } else if (this.connectionStatus === 'reconnecting') {
        statusEl.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background-color:#ff9800;border-radius:50%;animation:blink 1s infinite;"></span> 再接続中...';
        statusEl.style.backgroundColor = 'rgba(255, 152, 0, 0.2)';
        statusEl.style.color = '#ff9800';
        statusEl.style.opacity = '1';
      } else {
        statusEl.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background-color:#f44336;border-radius:50%;"></span> 切断されました';
        statusEl.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
        statusEl.style.color = '#f44336';
        statusEl.style.opacity = '1';
      }
      
      // 点滅アニメーション用スタイルの追加
      if (!document.getElementById('blink-animation')) {
        const style = document.createElement('style');
        style.id = 'blink-animation';
        style.textContent = `
          @keyframes blink {
            0% { opacity: 0.3; }
            50% { opacity: 1; }
            100% { opacity: 0.3; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  };