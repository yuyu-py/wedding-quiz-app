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
  let currentScreen = 'welcome'; // 画面状態: welcome, explanation, quiz_title, quiz_question, quiz_answer, ranking
  let currentQuizId = null;      // 現在の問題ID
  let quizPhase = 'title';       // 問題表示状態: title, question, answer
  let rankingPosition = 'none';  // ランキング表示: none, 5, 4, 3, 2, 1, all
  let quiz5Answer = '';          // クイズ5の答え
  
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
    { id: 'quiz5_answer', label: '問題5 解答', quizId: 5, phase: 'answer', step: stepQuiz5 },
    { id: 'ranking5', label: 'ランキング 5位', rankingPos: '5', step: stepRanking },
    { id: 'ranking4', label: 'ランキング 4位', rankingPos: '4', step: stepRanking },
    { id: 'ranking3', label: 'ランキング 3位', rankingPos: '3', step: stepRanking },
    { id: 'ranking2', label: 'ランキング 2位', rankingPos: '2', step: stepRanking },
    { id: 'ranking1', label: 'ランキング 1位', rankingPos: '1', step: stepRanking },
    { id: 'rankingAll', label: 'ランキング 全て', rankingPos: 'all', step: stepRanking }
  ];
  
  let currentSequenceIndex = 0;
  
  // Socket.io接続
  const socket = io();
  
  // 接続時の処理
  socket.on('connect', () => {
    console.log('Socket.io に接続しました');
    // 管理者として登録
    socket.emit('register', { type: 'admin' });
    // クイズデータの取得
    fetchQuizzes();
  });
  
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
  
  // クイズイベントを受信（プレビュー用）
  socket.on('quiz_event', (data) => {
    const { event, quizId, position } = data;
    
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
        
        // シーケンス更新
        const quizAnswerIndex = sequence.findIndex(item => 
          item.quizId === currentQuizId && item.phase === 'answer');
        if (quizAnswerIndex !== -1) {
          updateSequenceDisplay(quizAnswerIndex);
        }
        break;
        
      case 'show_ranking':
        currentScreen = 'ranking';
        rankingPosition = position;
        currentMode.textContent = position === 'all' ? 'ランキング全表示' : `ランキング ${position}位`;
        
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
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
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
        
        return true;
      } else {
        quiz5Status.textContent = '答えの設定に失敗しました';
        return false;
      }
    } catch (error) {
      console.error('クイズ5の答え設定に失敗しました:', error);
      quiz5Status.textContent = 'エラーが発生しました';
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
  
  // クイズ5の設定パネル表示/非表示
  function toggleQuiz5Panel() {
    if (currentQuizId === 5 && (currentScreen === 'quiz_title' || currentScreen === 'quiz_question')) {
      quiz5Panel.classList.remove('hidden');
    } else {
      quiz5Panel.classList.add('hidden');
    }
  }
  
  // 次の画面に進む
  async function goToNextScreen() {
    // クイズ5の解答前に答えが設定されているか確認
    if (currentQuizId === 5 && currentScreen === 'quiz_question' && !quiz5Answer) {
      quiz5Status.textContent = '先に答えを設定してください';
      return;
    }
    
    if (currentSequenceIndex < sequence.length - 1) {
      currentSequenceIndex++;
      const nextStep = sequence[currentSequenceIndex];
      
      // 次のシーケンスアイテム情報に基づいてコマンド実行
      if (nextStep.id === 'explanation') {
        sendQuizCommand('start_quiz');
      }
      else if (nextStep.phase === 'title' && nextStep.quizId) {
        // 問題表示開始
        if (await startQuizSession(nextStep.quizId)) {
          sendQuizCommand('show_question', nextStep.quizId);
        }
      }
      else if (nextStep.phase === 'question' || nextStep.phase === 'answer') {
        // 次のスライドに移動
        sendQuizCommand('next_slide');
      }
      else if (nextStep.rankingPos) {
        // ランキング表示
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
  
  // ボタンイベントの設定
  prevSlideButton.addEventListener('click', goToPrevScreen);
  nextSlideButton.addEventListener('click', goToNextScreen);
  
  // クイズ5の答え設定ボタン
  quiz5Option1.addEventListener('click', () => setQuiz5Answer('新郎'));
  quiz5Option2.addEventListener('click', () => setQuiz5Answer('新婦'));
  
  // リセットボタン
  resetButton.addEventListener('click', resetAllData);
  
  // 初期化：最初のシーケンスステップをアクティブに
  updateSequenceDisplay(0);
});
