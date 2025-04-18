// public/js/admin.js
// 管理画面用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 要素の取得
  const participantCount = document.getElementById('participant-count');
  const currentQuizNumber = document.getElementById('current-quiz-number');
  const currentAnswersCount = document.getElementById('current-answers-count');
  const currentMode = document.getElementById('current-mode');
  
  // ナビゲーションボタン
  const prevSlideButton = document.getElementById('prev-slide');
  const nextSlideButton = document.getElementById('next-slide');
  
  // クイズ5の設定パネル
  const quiz5Panel = document.getElementById('quiz5-panel');
  const quiz5Option1 = document.getElementById('quiz5-option1');
  const quiz5Option2 = document.getElementById('quiz5-option2');
  const quiz5Status = document.getElementById('quiz5-status');
  
  // リセットボタン
  const resetButton = document.getElementById('reset-button');
  const resetStatus = document.getElementById('reset-status');
  
  // シーケンスステップ
  const stepWelcome = document.getElementById('step-welcome');
  const stepExplanation = document.getElementById('step-explanation');
  const stepQuiz1 = document.getElementById('step-quiz1');
  const stepQuiz2 = document.getElementById('step-quiz2');
  const stepQuiz3 = document.getElementById('step-quiz3');
  const stepQuiz4 = document.getElementById('step-quiz4');
  const stepQuiz5 = document.getElementById('step-quiz5');
  const stepRanking = document.getElementById('step-ranking');
  
  // 状態管理
  let quizzes = [];
  let currentScreen = 'welcome'; // 画面状態: welcome, explanation, quiz_title, quiz_question, quiz_answer, ranking, practice
  let currentQuizId = null;      // 現在の問題ID
  let quizPhase = 'title';       // 問題表示状態: title, question, answer, practice
  let rankingPosition = 'none';  // ランキング表示: none, 5, 4, 3, 2, 1, all
  let quiz5Answer = '';          // クイズ5の答え
  
  let currentQuizState = {
    quizId: null,
    phase: null
  };
  
  // シーケンス管理
  const sequence = [
    { id: 'welcome', label: '参加者募集', step: stepWelcome },
    { id: 'explanation', label: 'クイズ説明', step: stepExplanation },
    { id: 'quiz1_title', label: '問題1 タイトル', quizId: 1, phase: 'title', step: stepQuiz1 },
    { id: 'quiz1_question', label: '問題1 問題', quizId: 1, phase: 'question', step: stepQuiz1 },
    { id: 'quiz1_answer', label: '問題1 解答', quizId: 1, phase: 'answer', step: stepQuiz1 },
    { id: 'quiz2_title', label: '問題2 タイトル', quizId: 2, phase: 'title', step: stepQuiz2 },
    { id: 'quiz2_question', label: '問題2 問題', quizId: 2, phase: 'question', step: stepQuiz2 },
    { id: 'quiz2_answer', label: '問題2 解答', quizId: 2, phase: 'answer', step: stepQuiz2 },
    { id: 'quiz3_title', label: '問題3 タイトル', quizId: 3, phase: 'title', step: stepQuiz3 },
    { id: 'quiz3_question', label: '問題3 問題', quizId: 3, phase: 'question', step: stepQuiz3 },
    { id: 'quiz3_answer', label: '問題3 解答', quizId: 3, phase: 'answer', step: stepQuiz3 },
    { id: 'quiz4_title', label: '問題4 タイトル', quizId: 4, phase: 'title', step: stepQuiz4 },
    { id: 'quiz4_question', label: '問題4 問題', quizId: 4, phase: 'question', step: stepQuiz4 },
    { id: 'quiz4_answer', label: '問題4 解答', quizId: 4, phase: 'answer', step: stepQuiz4 },
    { id: 'quiz5_title', label: '問題5 タイトル', quizId: 5, phase: 'title', step: stepQuiz5 },
    { id: 'quiz5_question', label: '問題5 問題', quizId: 5, phase: 'question', step: stepQuiz5 },
    { id: 'quiz5_practice', label: '問題5 実践', quizId: 5, phase: 'practice', step: stepQuiz5 },
    { id: 'quiz5_answer', label: '問題5 解答', quizId: 5, phase: 'answer', step: stepQuiz5 },
    // 追加: ランキング準備（文字だけ）
    { id: 'ranking_intro', label: 'ランキング準備', rankingPos: 'intro', step: stepRanking },
    { id: 'ranking5', label: 'ランキング 5位', rankingPos: '5', step: stepRanking },
    { id: 'ranking4', label: 'ランキング 4位', rankingPos: '4', step: stepRanking },
    { id: 'ranking3', label: 'ランキング 3位', rankingPos: '3', step: stepRanking },
    { id: 'ranking2', label: 'ランキング 2位', rankingPos: '2', step: stepRanking },
    { id: 'ranking1', label: 'ランキング 1位', rankingPos: '1', step: stepRanking },
    { id: 'rankingAll', label: 'ランキング 全て', rankingPos: 'all', step: stepRanking }
  ];
    
  let currentSequenceIndex = 0;
  
  // Socket.io接続（Socket Manager利用）
  const socket = SocketManager.init();
  
  // 接続時の処理
  socket.on('connect', () => {
    console.log('Socket.io に接続しました');
    // 管理者として登録
    socket.emit('register', { type: 'admin' });
    // クイズデータの取得
    fetchQuizzes();
  });
  
  // 状態更新関数
  function updateServerState(stateUpdate) {
    console.log('Admin: サーバー状態更新:', stateUpdate);
    
    // API呼び出し
    fetch('/api/quiz/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stateUpdate)
    })
    .then(response => response.json())
    .then(data => {
      console.log('状態更新結果:', data);
    })
    .catch(error => {
      console.error('状態更新エラー:', error);
    });
  }
  
  // 登録完了時の処理
  socket.on('registered', (data) => {
    console.log('登録が完了しました:', data);
  });
  
  // 接続数の更新
  socket.on('connection_stats', (stats) => {
    participantCount.textContent = stats.players;
  });
  
  // 回答更新の処理
  socket.on('answer_update', (data) => {
    if (data.quizId === currentQuizId) {
      updateQuizStats();
    }
  });
  
  // 管理者専用の実践画面遷移イベント
  socket.on('admin_force_practice', (data) => {
    const { quizId } = data;
    
    if (quizId === '5') {
      console.log('Admin: 問題5の実践画面に強制遷移します');
      
      // 状態を実践に設定
      currentQuizState.quizId = 5;
      currentQuizState.phase = 'practice';
      currentScreen = 'practice';
      currentMode.textContent = '問題5 実践中';
      
      // クイズ5パネルをリセット
      resetQuiz5Panel();
      
      // シーケンス更新
      const quizPracticeIndex = sequence.findIndex(item => 
        item.quizId === 5 && item.phase === 'practice');
      if (quizPracticeIndex !== -1) {
        currentSequenceIndex = quizPracticeIndex;
        updateSequenceDisplay(quizPracticeIndex);
      }
    }
  });
  
  // 強制遷移イベント処理
  socket.on('force_transition', (data) => {
    const { quizId, target, isPractice } = data;
    console.log(`[DEBUG] force_transition受信: quizId=${quizId}(${typeof quizId}), target=${target}, isPractice=${isPractice}`);
    
    // 修正: 型安全な比較
    if ((quizId == '5' || quizId === 5) && target === 'practice' && isPractice) {
      console.log('[DEBUG] 問題5実践画面遷移条件一致 - 処理開始');
      
      // 状態を実践に設定
      currentQuizState.quizId = 5;
      currentQuizState.phase = 'practice';
      currentScreen = 'practice';
      currentMode.textContent = '問題5 実践中';
      
      // クイズ5パネルをリセット
      resetQuiz5Panel();
      
      // シーケンス更新
      const quizPracticeIndex = sequence.findIndex(item => 
        item.quizId === 5 && item.phase === 'practice');
      if (quizPracticeIndex !== -1) {
        currentSequenceIndex = quizPracticeIndex;
        updateSequenceDisplay(quizPracticeIndex);
      }
      
      console.log('[DEBUG] 問題5実践画面遷移処理完了');
    } else {
      if (quizId == '5') {
        console.log(`[DEBUG] 問題5だが条件不一致: target=${target}, isPractice=${isPractice}`);
      }
    }
  });
  
  // クイズイベント処理
  socket.on('quiz_event', (data) => {
    const { event, quizId, position, auto, manual, fromPractice, isPractice } = data;
    
    // 問題5の実践画面表示イベント
    if (event === 'show_practice' && quizId === '5' && isPractice) {
      console.log('Admin: 問題5の実践画面表示イベント受信');
      
      // 状態を実践に設定
      currentQuizState.quizId = 5;
      currentQuizState.phase = 'practice';
      currentScreen = 'practice';
      currentMode.textContent = '問題5 実践中';
      
      // クイズ5パネルをリセット
      resetQuiz5Panel();
      
      // シーケンス更新
      const quizPracticeIndex = sequence.findIndex(item => 
        item.quizId === 5 && item.phase === 'practice');
      if (quizPracticeIndex !== -1) {
        currentSequenceIndex = quizPracticeIndex;
        updateSequenceDisplay(quizPracticeIndex);
      }
      
      return; // 他の処理はスキップ
    }
    
    switch (event) {
      case 'quiz_started':
        currentScreen = 'explanation';
        currentMode.textContent = 'クイズ説明';
        updateSequenceDisplay(1); // クイズ説明ステップへ
        break;
        
      case 'show_question':
        if (quizId) {
          currentQuizId = quizId;
          currentQuizNumber.textContent = quizId;
          currentScreen = 'quiz_title';
          quizPhase = 'title';
          currentMode.textContent = `問題${quizId} タイトル`;
          
          // クイズ状態を更新
          currentQuizState.quizId = quizId;
          currentQuizState.phase = 'title';
          
          updateQuizStats();
          
          // クイズ5の設定パネル表示/非表示
          toggleQuiz5Panel();
          
          // シーケンス更新
          const quizTitleIndex = sequence.findIndex(item => 
            item.quizId === quizId && item.phase === 'title');
          if (quizTitleIndex !== -1) {
            updateSequenceDisplay(quizTitleIndex);
          }
        }
        break;
        
      case 'next_slide':
        if (currentScreen === 'quiz_title') {
          currentScreen = 'quiz_question';
          quizPhase = 'question';
          currentMode.textContent = `問題${currentQuizId} 出題中`;
          
          // クイズ状態を更新
          currentQuizState.phase = 'question';
          
          // シーケンス更新
          const quizQuestionIndex = sequence.findIndex(item => 
            item.quizId === currentQuizId && item.phase === 'question');
          if (quizQuestionIndex !== -1) {
            updateSequenceDisplay(quizQuestionIndex);
          }
        } else if (currentScreen === 'quiz_question') {
          currentScreen = 'quiz_answer';
          quizPhase = 'answer';
          currentMode.textContent = `問題${currentQuizId} 解答`;
          
          // クイズ状態を更新
          currentQuizState.phase = 'answer';
          
          // シーケンス更新
          const quizAnswerIndex = sequence.findIndex(item => 
            item.quizId === currentQuizId && item.phase === 'answer');
          if (quizAnswerIndex !== -1) {
            updateSequenceDisplay(quizAnswerIndex);
          }
        }
        break;
        
      case 'prev_slide':
        if (currentScreen === 'quiz_question') {
          currentScreen = 'quiz_title';
          quizPhase = 'title';
          currentMode.textContent = `問題${currentQuizId} タイトル`;
          
          // クイズ状態を更新
          currentQuizState.phase = 'title';
          
          // クイズ5の設定パネル表示/非表示
          toggleQuiz5Panel();
          
          // シーケンス更新
          const quizTitleIndex = sequence.findIndex(item => 
            item.quizId === currentQuizId && item.phase === 'title');
          if (quizTitleIndex !== -1) {
            updateSequenceDisplay(quizTitleIndex);
          }
        } else if (currentScreen === 'quiz_answer') {
          currentScreen = 'quiz_question';
          quizPhase = 'question';
          currentMode.textContent = `問題${currentQuizId} 出題中`;
          
          // クイズ状態を更新
          currentQuizState.phase = 'question';
          
          // シーケンス更新
          const quizQuestionIndex = sequence.findIndex(item => 
            item.quizId === currentQuizId && item.phase === 'question');
          if (quizQuestionIndex !== -1) {
            updateSequenceDisplay(quizQuestionIndex);
          }
        }
        break;
        
      case 'show_answer':
        currentScreen = 'quiz_answer';
        quizPhase = 'answer';
        currentMode.textContent = `問題${currentQuizId} 解答`;
        
        // クイズ状態を更新
        currentQuizState.phase = 'answer';
        
        // シーケンス更新
        const quizAnswerIndex = sequence.findIndex(item => 
          item.quizId === currentQuizId && item.phase === 'answer');
        if (quizAnswerIndex !== -1) {
          updateSequenceDisplay(quizAnswerIndex);
        }
        break;
        
      case 'show_practice':
        if (quizId === '5') {
          currentMode.textContent = '問題5 実践中';
          currentScreen = 'practice';
          
          // クイズ状態を更新
          currentQuizState.phase = 'practice';
          
          // 重要: 実践画面に遷移したら勝敗選択をリセット
          resetQuiz5Panel();
          
          // シーケンス更新
          const quizPracticeIndex = sequence.findIndex(item => 
            item.quizId === 5 && item.phase === 'practice');
          if (quizPracticeIndex !== -1) {
            updateSequenceDisplay(quizPracticeIndex);
          }
        }
        break;
        
      case 'show_ranking':
        currentScreen = 'ranking';
        rankingPosition = position;
        
        if (position === 'intro') {
          currentMode.textContent = 'ランキング準備';
        } else if (position === 'all') {
          currentMode.textContent = 'ランキング全表示';
        } else {
          currentMode.textContent = `ランキング ${position}位`;
        }
        
        // シーケンス更新
        const rankingIndex = sequence.findIndex(item => 
          item.rankingPos === position);
        if (rankingIndex !== -1) {
          updateSequenceDisplay(rankingIndex);
        }
        break;
        
      case 'reset_all':
        // リセットイベントの処理
        currentScreen = 'welcome';
        currentQuizId = null;
        quizPhase = 'title';
        rankingPosition = 'none';
        quiz5Answer = '';
        
        // クイズ状態をリセット
        currentQuizState.quizId = null;
        currentQuizState.phase = null;
        
        updateSequenceDisplay(0);
        break;
    }
  });
    
  // すべてのクイズを取得
  async function fetchQuizzes() {
    try {
      const response = await fetch('/api/quiz');
      quizzes = await response.json();
      console.log('クイズデータを取得しました:', quizzes);
      
      // データ取得後に初期状態を同期
      fetch('/api/quiz/state')
        .then(response => response.json())
        .then(data => {
          if (data.success && data.state) {
            syncAdminWithState(data.state);
          }
        })
        .catch(error => {
          console.error('状態同期に失敗:', error);
        });
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
    }
  }
  
  // 管理画面を状態と同期する関数
  function syncAdminWithState(state) {
    console.log('管理画面の状態同期:', state);
    
    // 画面タイプに応じた状態更新
    switch(state.screen) {
      case 'welcome':
        currentScreen = 'welcome';
        currentQuizId = null;
        quizPhase = 'title';
        updateSequenceDisplay(0);
        break;
        
      case 'explanation':
        currentScreen = 'explanation';
        currentQuizId = null;
        quizPhase = null;
        updateSequenceDisplay(1);
        break;
        
      case 'quiz_title':
        if (state.quizId) {
          currentQuizId = state.quizId;
          currentScreen = 'quiz_title';
          quizPhase = 'title';
          
          const quizTitleIndex = sequence.findIndex(item => 
            item.quizId == state.quizId && item.phase === 'title');
          if (quizTitleIndex !== -1) {
            updateSequenceDisplay(quizTitleIndex);
          }
        }
        break;
        
      case 'quiz_question':
        if (state.quizId) {
          currentQuizId = state.quizId;
          currentScreen = 'quiz_question';
          quizPhase = 'question';
          
          const quizQuestionIndex = sequence.findIndex(item => 
            item.quizId == state.quizId && item.phase === 'question');
          if (quizQuestionIndex !== -1) {
            updateSequenceDisplay(quizQuestionIndex);
          }
        }
        break;
        
      case 'quiz_answer':
        if (state.quizId) {
          currentQuizId = state.quizId;
          currentScreen = 'quiz_answer';
          quizPhase = 'answer';
          
          const quizAnswerIndex = sequence.findIndex(item => 
            item.quizId == state.quizId && item.phase === 'answer');
          if (quizAnswerIndex !== -1) {
            updateSequenceDisplay(quizAnswerIndex);
          }
        }
        break;
        
      case 'practice':
        if (state.quizId == 5) {
          currentQuizId = 5;
          currentScreen = 'practice';
          quizPhase = 'practice';
          
          const quizPracticeIndex = sequence.findIndex(item => 
            item.quizId === 5 && item.phase === 'practice');
          if (quizPracticeIndex !== -1) {
            updateSequenceDisplay(quizPracticeIndex);
          }
          
          resetQuiz5Panel();
        }
        break;
        
      case 'ranking':
        currentScreen = 'ranking';
        rankingPosition = state.rankingPosition || 'all';
        
        const rankingIndex = sequence.findIndex(item => 
          item.rankingPos === state.rankingPosition);
        if (rankingIndex !== -1) {
          updateSequenceDisplay(rankingIndex);
        }
        break;
    }
    
    // クイズ5のパネルの表示/非表示を更新
    toggleQuiz5Panel();
    
    // 問題統計を更新
    if (currentQuizId) {
      updateQuizStats();
    }
  }
    
  // クイズの統計情報を更新
  async function updateQuizStats() {
    if (!currentQuizId) return;
    
    try {
      const response = await fetch(`/api/quiz/${currentQuizId}/stats`);
      const stats = await response.json();
      
      currentAnswersCount.textContent = stats.totalParticipants;
      
    } catch (error) {
      console.error('クイズ統計の取得に失敗しました:', error);
    }
  }
    
  // クイズセッションを開始
  async function startQuizSession(quizId) {
    try {
      const response = await fetch(`/api/quiz/start/${quizId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      console.log('クイズセッション開始:', result);
      return result.success;
      
    } catch (error) {
      console.error('クイズセッション開始に失敗しました:', error);
      return false;
    }
  }
    
  // クイズコマンドを送信
  function sendQuizCommand(command, quizId = null, params = {}) {
    console.log(`Admin: コマンド送信 - ${command}, クイズID: ${quizId || 'なし'}, パラメータ:`, params);
    
    // 問題5の実践→解答遷移の特別処理
    if (command === 'show_answer' && quizId === '5' && params.fromPractice) {
      console.log('Admin: 問題5の実践から解答への遷移を送信（特別処理）');
      // 状態をより明確に更新
      currentQuizState.phase = 'answer';
      currentScreen = 'quiz_answer';
      currentMode.textContent = '問題5 解答';
    }
    
    // アプリケーション状態を更新
    let stateUpdate = {};
    
    switch (command) {
      case 'start_quiz':
        stateUpdate = { screen: 'explanation', quizId: null, phase: null };
        break;
      case 'show_question':
        stateUpdate = { screen: 'quiz_title', quizId, phase: 'title' };
        break;
      case 'next_slide':
        // 現在の状態に基づいて次の状態を決定
        if (currentQuizState.phase === 'title') {
          stateUpdate = { screen: 'quiz_question', quizId: currentQuizId, phase: 'question' };
        } else if (currentQuizState.phase === 'question') {
          stateUpdate = { screen: 'quiz_answer', quizId: currentQuizId, phase: 'answer' };
        } else if (currentQuizState.phase === 'practice' && currentQuizId === 5) {
          stateUpdate = { screen: 'quiz_answer', quizId: currentQuizId, phase: 'answer' };
        }
        break;
      case 'show_answer':
        stateUpdate = { screen: 'quiz_answer', quizId, phase: 'answer' };
        break;
      case 'show_practice':
        if (quizId === '5') {
          stateUpdate = { screen: 'practice', quizId, phase: 'practice' };
        }
        break;
      case 'show_ranking':
        stateUpdate = { 
          screen: 'ranking', 
          quizId: null, 
          phase: null, 
          rankingPosition: params.position || 'all' 
        };
        break;
      case 'reset_all':
        stateUpdate = { screen: 'welcome', quizId: null, phase: null, rankingPosition: null };
        break;
    }
    
    // サーバーの状態を更新
    if (Object.keys(stateUpdate).length > 0) {
      updateServerState(stateUpdate);
    }
    
    socket.emit('quiz_command', {
      command,
      quizId,
      params
    });
  }
  
  // クイズ5の答えを設定
  async function setQuiz5Answer(answer) {
    try {
      const response = await fetch('/api/admin/quiz/5/set-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answer })
      });
      
      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        quiz5Answer = answer;
        quiz5Status.textContent = `答えを「${answer}」に設定しました`;
        
        // ボタンの状態を更新
        quiz5Option1.classList.remove('selected');
        quiz5Option2.classList.remove('selected');
        
        if (answer === '新郎') {
          quiz5Option1.classList.add('selected');
        } else if (answer === '新婦') {
          quiz5Option2.classList.add('selected');
        }
        
        // 答え設定成功メッセージの表示（少し目立つように）
        quiz5Status.style.color = '#4caf50';
        quiz5Status.style.fontWeight = 'bold';
        setTimeout(() => {
          quiz5Status.style.color = '';
          quiz5Status.style.fontWeight = '';
        }, 3000);
        
        return true;
      } else {
        quiz5Status.textContent = `答えの設定に失敗しました: ${result.error || '不明なエラー'}`;
        quiz5Status.style.color = '#f44336';
        return false;
      }
    } catch (error) {
      console.error('クイズ5の答え設定中にエラーが発生しました:', error);
      quiz5Status.textContent = `エラーが発生しました: ${error.message}`;
      quiz5Status.style.color = '#f44336';
      return false;
    }
  }
    
  // データをリセット
  async function resetAllData() {
    try {
      // 確認ダイアログを表示
      if (!confirm('本当にすべてのデータをリセットしますか？\n参加者情報、回答データ、セッション情報がすべて削除されます。')) {
        return false;
      }
      
      resetStatus.textContent = 'リセット中...';
      
      const response = await fetch('/api/admin/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        resetStatus.textContent = 'リセットが完了しました';
        
        // リセットコマンドを送信
        sendQuizCommand('reset_all');
        
        // 最初の画面に戻る
        updateSequenceDisplay(0);
        
        // 問題5の状態追跡をリセット
        currentQuizState = {
          quizId: null,
          phase: null
        };
        
        return true;
      } else {
        resetStatus.textContent = 'リセットに失敗しました: ' + result.error;
        return false;
      }
    } catch (error) {
      console.error('データリセット中にエラーが発生しました:', error);
      resetStatus.textContent = 'エラーが発生しました';
      return false;
    }
  }
  
  // クイズ5パネルをリセットする関数
  function resetQuiz5Panel() {
    console.log('クイズ5パネルをリセット');
    
    // 選択をクリア
    quiz5Answer = '';
    quiz5Option1.classList.remove('selected');
    quiz5Option2.classList.remove('selected');
    
    // ステータスメッセージをリセット
    quiz5Status.textContent = '実践終了後、勝者を選択してください';
    quiz5Status.style.color = '#856404';
    
    // パネルを表示
    quiz5Panel.classList.remove('hidden');
  }
    
  // クイズ5の設定パネル表示/非表示
  function toggleQuiz5Panel() {
    if (currentQuizId === 5) {
      // 問題5の場合は常にパネルを表示
      quiz5Panel.classList.remove('hidden');
    } else {
      quiz5Panel.classList.add('hidden');
    }
  }
    
  // 次の画面に進む
  function goToNextScreen() {
    console.log('次へボタン押下 - 現在の状態:', {
      currentQuizId, 
      phase: currentQuizState.phase,
      sequenceIndex: currentSequenceIndex,
      screen: currentScreen
    });
    
    // 問題5の実践画面からの遷移時の検証
    if (currentQuizId === 5 && currentQuizState.phase === 'practice') {
      console.log('問題5の実践画面から次へ - 勝者選択チェック');
      
      // 答えが設定されていない場合は進行不可
      if (!quiz5Answer) {
        quiz5Status.textContent = '先に勝者を選択してください';
        quiz5Status.style.color = '#dc3545';
        quiz5Status.style.fontWeight = 'bold';
        setTimeout(() => {
          quiz5Status.style.fontWeight = 'normal';
        }, 1500);
        return; // 遷移を中止
      }
      
      console.log(`問題5: 勝者「${quiz5Answer}」で解答画面に遷移します`);
      
      // 実践から解答への特別遷移コマンド
      sendQuizCommand('show_answer', '5', { 
        fromPractice: true,
        answer: quiz5Answer,
        manualAdvance: true // 管理者による手動進行を明示
      });
      
      // 状態を更新
      currentQuizState.phase = 'answer';
      currentScreen = 'quiz_answer';
      
      // シーケンス更新
      const quizAnswerIndex = sequence.findIndex(item => 
        item.quizId === 5 && item.phase === 'answer');
      if (quizAnswerIndex !== -1) {
        currentSequenceIndex = quizAnswerIndex;
        updateSequenceDisplay(quizAnswerIndex);
      }
      
      return; // 個別処理したので、以降の処理はスキップ
    }
    
    if (currentSequenceIndex < sequence.length - 1) {
      currentSequenceIndex++;
      const nextStep = sequence[currentSequenceIndex];
      
      console.log('次のステップ:', nextStep); // デバッグログ追加
      
      // 次のシーケンスアイテム情報に基づいてコマンド実行
      if (nextStep.id === 'explanation') {
        sendQuizCommand('start_quiz');
      }
      else if (nextStep.phase === 'title' && nextStep.quizId) {
        // 問題表示開始
        console.log(`問題${nextStep.quizId}のタイトル画面に遷移します`);
        startQuizSession(nextStep.quizId).then(success => {
          if (success) {
            sendQuizCommand('show_question', nextStep.quizId);
          }
        });
      }
      else if (nextStep.phase === 'question') {
        // 問題タイトルから問題表示への遷移
        console.log('問題タイトルから問題表示に遷移します');
        sendQuizCommand('next_slide');
      }
      else if (nextStep.phase === 'answer') {
        // 問題表示から解答表示への遷移
        console.log('問題表示から解答表示に遷移します');
        sendQuizCommand('next_slide');
      }
      else if (nextStep.rankingPos) {
        // ランキング表示（intro, 5, 4, 3, 2, 1, all）
        sendQuizCommand('show_ranking', null, { position: nextStep.rankingPos });
      }
      
      updateSequenceDisplay(currentSequenceIndex);
    }
  }
    
  // 前の画面に戻る
  function goToPrevScreen() {
    if (currentSequenceIndex > 0) {
      currentSequenceIndex--;
      const prevStep = sequence[currentSequenceIndex];
      
      // 前のシーケンスアイテム情報に基づいてコマンド実行
      if (prevStep.id === 'welcome' || prevStep.id === 'explanation') {
        // 最初の2ステップに戻る場合は制御しない
        // 実装が複雑になるため、最初からやり直す場合はページリロードを推奨
      }
      else if (prevStep.phase === 'title' || prevStep.phase === 'question') {
        // 前のスライドに移動
        sendQuizCommand('prev_slide');
      }
      else if (prevStep.rankingPos) {
        // ランキング表示を特定位置に変更
        sendQuizCommand('show_ranking', null, { position: prevStep.rankingPos });
      }
      
      updateSequenceDisplay(currentSequenceIndex);
    }
  }
    
  // シーケンス表示を更新
  function updateSequenceDisplay(index) {
    // 現在のシーケンスインデックスを更新
    currentSequenceIndex = index;
    
    // すべてのステップをリセット
    sequence.forEach(item => {
      if (item.step) {
        item.step.classList.remove('active', 'completed');
      }
    });
    
    // 現在のステップをアクティブに
    const currentStep = sequence[index];
    if (currentStep && currentStep.step) {
      currentStep.step.classList.add('active');
    }
    
    // 過去のステップを完了状態に
    for (let i = 0; i < index; i++) {
      const step = sequence[i];
      if (step && step.step) {
        step.step.classList.add('completed');
      }
    }
    
    // 現在のモード表示を更新
    currentMode.textContent = currentStep.label;
    
    // 問題番号の更新
    if (currentStep.quizId) {
      currentQuizId = currentStep.quizId;
      currentQuizNumber.textContent = currentStep.quizId;
      
      // クイズ5の設定パネル表示/非表示
      toggleQuiz5Panel();
      
      // 問題の統計情報を更新
      updateQuizStats();
    } else {
      currentQuizNumber.textContent = '-';
    }
  }

  // ブラウザの更新時に同期
  window.addEventListener('load', function() {
    fetch('/api/quiz/state')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.state) {
          syncAdminWithState(data.state);
        }
      })
      .catch(error => {
        console.error('状態同期に失敗:', error);
      });
  });
    
  // ボタンイベントの設定
  prevSlideButton.addEventListener('click', goToPrevScreen);
  nextSlideButton.addEventListener('click', goToNextScreen);
    
  // クイズ5の答え選択ボタン
  quiz5Option1.addEventListener('click', () => {
    setQuiz5Answer('新郎');
    quiz5Option1.classList.add('selected');
    quiz5Option2.classList.remove('selected');
  });
  
  quiz5Option2.addEventListener('click', () => {
    setQuiz5Answer('新婦');
    quiz5Option1.classList.remove('selected');
    quiz5Option2.classList.add('selected');
  });
    
  // リセットボタン
  resetButton.addEventListener('click', resetAllData);
    
  // 初期化：最初のシーケンスステップをアクティブに
  updateSequenceDisplay(0);
  
  // 初期状態の設定 - シーケンス更新を追加
  window.addEventListener('DOMContentLoaded', () => {
    // ランキングシーケンスの順序を確認
    const rankingSequence = sequence.filter(item => item.rankingPos);
    console.log('ランキング表示順序:', rankingSequence.map(item => item.rankingPos));
  });
});