// 参加者画面用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 画面要素
  const registerScreen = document.getElementById('register-screen');
  const waitingScreen = document.getElementById('waiting-screen');
  const quizScreen = document.getElementById('quiz-screen');
  const answeredScreen = document.getElementById('answered-screen');
  const resultScreen = document.getElementById('result-screen');
  const homeButton = document.getElementById('home-button');
  
  // フォーム要素
  const playerNameInput = document.getElementById('player-name');
  const registerButton = document.getElementById('register-button');
  const displayName = document.getElementById('display-name');
  
  // クイズ要素
  const questionNumber = document.getElementById('question-number');
  const questionText = document.getElementById('question-text');
  const timerValue = document.getElementById('timer-value');
  const optionsContainer = document.getElementById('options-container');
  const answerStatusText = document.getElementById('answer-status-text');
  const yourAnswer = document.getElementById('your-answer');
  
  // 結果要素
  const correctCount = document.getElementById('correct-count');
  const totalTime = document.getElementById('total-time');
  const rankingPosition = document.getElementById('ranking-position');
  
  // 状態管理
  let playerId = null;
  let playerName = '';
  let currentQuizId = null;
  let selectedAnswer = null;
  let timerInterval = null;
  let timeLeft = 30;
  let playerAnswers = {};  // クイズIDと回答を保存
  let quizStartTimes = {}; // 問題の表示開始時間を保存
  
  // URLからプレイヤーIDを取得（既存ユーザーの場合）
  const urlParams = new URLSearchParams(window.location.search);
  const urlPlayerId = urlParams.get('id');
  
  if (urlPlayerId) {
    // 既存プレイヤーの情報を取得
    fetchPlayerInfo(urlPlayerId);
  }
  
  // 画面を表示する関数
  function showScreen(screen) {
    // すべての画面を非表示
    registerScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    quizScreen.classList.add('hidden');
    answeredScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    
    // 指定された画面を表示
    screen.classList.remove('hidden');
  }
  
  // ホーム画面に戻る
  function goToHome() {
    // タイマーを停止
    stopTimer();
    
    // 登録画面を表示
    showScreen(registerScreen);
  }
  
  // タイマーを開始する関数
  function startTimer(seconds = 30) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    timerValue.textContent = timeLeft;
    
    timerInterval = setInterval(() => {
      timeLeft--;
      timerValue.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (currentQuizId && !playerAnswers[currentQuizId]) {
          answerStatusText.textContent = '時間切れです';
        }
      }
    }, 1000);
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    clearInterval(timerInterval);
  }
  
  // プレイヤー情報を取得
  async function fetchPlayerInfo(id) {
    try {
      const response = await fetch(`/api/player/${id}`);
      
      if (response.ok) {
        const player = await response.json();
        playerId = player.id;
        playerName = player.name;
        
        // プレイヤー名を表示
        displayName.textContent = playerName;
        
        // Socket.io接続を開始
        initSocketConnection();
        
        // 待機画面を表示
        showScreen(waitingScreen);
        
        // 回答履歴を取得
        fetchPlayerAnswers();
        
      } else {
        // プレイヤーが見つからない場合は登録画面を表示
        showScreen(registerScreen);
      }
    } catch (error) {
      console.error('プレイヤー情報の取得に失敗しました:', error);
      showScreen(registerScreen);
    }
  }
  
  // プレイヤーの回答履歴を取得
  async function fetchPlayerAnswers() {
    if (!playerId) return;
    
    try {
      const response = await fetch(`/api/player/${playerId}/answers`);
      const data = await response.json();
      
      // 回答をプレイヤーAnswersに保存
      data.answers.forEach(answer => {
        playerAnswers[answer.quiz_id] = {
          answer: answer.answer,
          isCorrect: answer.is_correct === 1,
          responseTime: answer.response_time
        };
      });
      
      // 統計情報を更新
      if (data.stats) {
        correctCount.textContent = data.stats.correctCount;
        // ミリ秒から秒に変換して小数点2桁まで表示
        const seconds = (data.stats.totalResponseTime / 1000).toFixed(2);
        totalTime.textContent = seconds;
      }
      
    } catch (error) {
      console.error('回答履歴の取得に失敗しました:', error);
    }
  }
  
  // クイズの問題を取得して表示
  async function fetchAndShowQuestion(quizId) {
    if (!quizId) return;
    
    try {
      const response = await fetch(`/api/quiz/${quizId}`);
      const quizData = await response.json();
      
      // 問題番号と問題文を設定
      questionNumber.textContent = `問題 ${quizId}`;
      questionText.textContent = quizData.question;
      
      // 既に回答済みかチェック
      if (playerAnswers[quizId]) {
        // 回答済みの場合は回答待機画面を表示
        yourAnswer.textContent = playerAnswers[quizId].answer;
        showScreen(answeredScreen);
        return;
      }
      
      // 問題表示時刻を記録
      quizStartTimes[quizId] = new Date().getTime();
      
      // 画像選択肢かどうかを判断
      const isImageOptions = quizData.is_image_options === 1;
      
      // 選択肢を表示
      optionsContainer.innerHTML = '';
      
      if (isImageOptions) {
        // 画像選択肢の場合
        optionsContainer.className = 'image-options-container';
        
        quizData.options.forEach((option, index) => {
          const button = document.createElement('button');
          button.className = 'image-option-button';
          button.dataset.answer = (index + 1).toString();
          
          const img = document.createElement('img');
          img.src = option;
          img.alt = `選択肢 ${index + 1}`;
          
          const numberDiv = document.createElement('div');
          numberDiv.className = 'option-number';
          numberDiv.textContent = (index + 1).toString();
          
          button.appendChild(img);
          button.appendChild(numberDiv);
          
          button.addEventListener('click', () => selectAnswer((index + 1).toString(), quizId));
          optionsContainer.appendChild(button);
        });
      } else {
        // テキスト選択肢の場合
        optionsContainer.className = 'options-container';
        
        quizData.options.forEach(option => {
          const button = document.createElement('button');
          button.className = 'option-button';
          button.textContent = option;
          button.addEventListener('click', () => selectAnswer(option, quizId));
          optionsContainer.appendChild(button);
        });
      }
      
      // 選択された答えをリセット
      selectedAnswer = null;
      answerStatusText.textContent = '回答を選択してください';
      
      // クイズ画面を表示
      showScreen(quizScreen);
      
      // タイマーを開始
      startTimer();
      
      // 現在のクイズIDを保存
      currentQuizId = quizId;
      
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
    }
  }
  
  // 回答を選択する処理
  async function selectAnswer(answer, quizId) {
    if (playerAnswers[quizId]) return; // 既に回答済み
    
    // 選択した答えを保存
    selectedAnswer = answer;
    
    // 回答時刻と経過時間を計算
    const answerTime = new Date().getTime();
    // クイズ表示時刻がない場合は現在時刻から30秒前に設定
    const startTime = quizStartTimes[quizId] || (answerTime - 30000);
    const responseTime = answerTime - startTime;
    
    // 選択肢のスタイルを更新
    if (optionsContainer.classList.contains('image-options-container')) {
      // 画像選択肢の場合
      const optionButtons = optionsContainer.querySelectorAll('.image-option-button');
      optionButtons.forEach(button => {
        if (button.dataset.answer === answer) {
          button.classList.add('selected');
        }
      });
    } else {
      // テキスト選択肢の場合
      const optionButtons = optionsContainer.querySelectorAll('.option-button');
      optionButtons.forEach(button => {
        if (button.textContent === answer) {
          button.classList.add('selected');
        }
      });
    }
    
    // 回答を送信
    try {
      const response = await fetch('/api/player/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId,
          quizId,
          answer,
          responseTime // 計算した応答時間を送信
        })
      });
      
      const result = await response.json();
      
      // 回答結果を保存
      playerAnswers[quizId] = {
        answer,
        isCorrect: result.isCorrect,
        responseTime: responseTime // APIから返される時間ではなく、クライアントで計算した時間を使用
      };
      
      // 回答結果を表示
      answerStatusText.textContent = '回答が送信されました';
      
      // Socket.ioで回答イベントを送信
      socket.emit('submit_answer', {
        playerId,
        quizId,
        answer,
        responseTime
      });
      
      // 回答待機画面に切り替え
      yourAnswer.textContent = answer;
      showScreen(answeredScreen);
      
    } catch (error) {
      console.error('回答の送信に失敗しました:', error);
      answerStatusText.textContent = '回答の送信に失敗しました';
    }
  }
  
  // プレイヤーのランキングを取得して表示
  async function fetchAndShowRanking() {
    if (!playerId) return;
    
    try {
      // ランキング全体を取得
      const response = await fetch('/api/quiz/ranking/all');
      const rankings = await response.json();
      
      // 自分の順位を探す
      let playerRanking = null;
      let playerPosition = 0;
      
      for (let i = 0; i < rankings.length; i++) {
        if (rankings[i].player_id === playerId) {
          playerRanking = rankings[i];
          playerPosition = i + 1;
          break;
        }
      }
      
      // ランキング情報を表示
      if (playerRanking) {
        correctCount.textContent = playerRanking.correct_count;
        // ミリ秒から秒に変換して小数点2桁まで表示
        const seconds = (playerRanking.total_time / 1000).toFixed(2);
        totalTime.textContent = seconds;
        
        // 順位によってメッセージを変更
        let rankingMessage = '';
        
        if (playerPosition <= 3) {
          rankingMessage = `おめでとうございます！あなたは${playerPosition}位です！`;
        } else if (playerPosition <= 5) {
          rankingMessage = `あなたは${playerPosition}位でした！`;
        } else {
          rankingMessage = `あなたの順位は${playerPosition}位です。お疲れ様でした！`;
        }
        
        rankingPosition.textContent = rankingMessage;
      } else {
        rankingPosition.textContent = 'ランキングデータが取得できませんでした';
      }
      
      // 結果画面を表示
      showScreen(resultScreen);
      
    } catch (error) {
      console.error('ランキングの取得に失敗しました:', error);
      rankingPosition.textContent = 'ランキングデータの取得に失敗しました';
      showScreen(resultScreen);
    }
  }
  
  // Socket.io接続の初期化
  let socket;
  function initSocketConnection() {
    if (socket) return; // 既に接続済み
    
    socket = io();
    
    // 接続時の処理
    socket.on('connect', () => {
      console.log('Socket.io に接続しました');
      // プレイヤーとして登録
      socket.emit('register', { type: 'player', playerId });
    });
    
    // 登録完了時の処理
    socket.on('registered', (data) => {
      console.log('登録が完了しました:', data);
    });
    
    // クイズイベントの処理
    socket.on('quiz_event', (data) => {
      const { event, quizId } = data;
      
      switch (event) {
        case 'quiz_started':
          // クイズ開始時の処理
          showScreen(waitingScreen);
          break;
          
        case 'show_question':
          // 問題表示の準備
          if (quizId) {
            currentQuizId = quizId;
          }
          break;
          
        case 'next_slide':
          // クイズ画面表示
          if (currentQuizId) {
            fetchAndShowQuestion(currentQuizId);
          }
          break;
          
        case 'show_answer':
          // 解答表示時の処理（プレイヤーは待機画面のまま）
          stopTimer();
          break;
          
        case 'show_ranking':
          // ランキング表示の処理
          fetchAndShowRanking();
          break;
          
        case 'reset_all':
          // リセット処理
          goToHome();
          break;
      }
    });
    
    // ホーム画面に戻るイベント
    socket.on('go_home_event', () => {
      goToHome();
    });
  }
  
  // プレイヤー登録処理
  registerButton.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    
    if (!name) {
      alert('名前を入力してください');
      return;
    }
    
    try {
      const response = await fetch('/api/player/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      
      const result = await response.json();
      
      if (result.success) {
        playerId = result.playerId;
        playerName = result.name;
        
        // URLに参加者IDを追加（リロード時に再利用できるように）
        const url = new URL(window.location);
        url.searchParams.set('id', playerId);
        window.history.replaceState({}, '', url);
        
        // プレイヤー名を表示
        displayName.textContent = playerName;
        
        // Socket.io接続を開始
        initSocketConnection();
        
        // 待機画面を表示
        showScreen(waitingScreen);
        
      } else {
        alert('登録に失敗しました: ' + result.error);
      }
    } catch (error) {
      console.error('プレイヤーの登録に失敗しました:', error);
      alert('登録処理中にエラーが発生しました');
    }
  });
  
  // ホームボタンのクリックイベント
  homeButton.addEventListener('click', () => {
    goToHome();
  });
  
  // 初期画面を表示
  if (!urlPlayerId) {
    showScreen(registerScreen);
  }
});
