// 参加者画面用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 画面要素
  const registerScreen = document.getElementById('register-screen');
  const waitingScreen = document.getElementById('waiting-screen');
  const explanationScreen = document.getElementById('explanation-screen');
  const quizScreen = document.getElementById('quiz-screen');
  const answeredScreen = document.getElementById('answered-screen');
  const answerResultScreen = document.getElementById('answer-result-screen');
  const resultScreen = document.getElementById('result-screen');
  
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
  const resultStatus = document.getElementById('result-status');
  const resultOptions = document.getElementById('result-options');
  const answerExplanation = document.getElementById('answer-explanation');
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
  let currentQuizData = null; // 現在の問題データを保存
  
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
    explanationScreen.classList.add('hidden');
    quizScreen.classList.add('hidden');
    answeredScreen.classList.add('hidden');
    answerResultScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    
    // 指定された画面を表示
    screen.classList.remove('hidden');
  }
  
  // タイマーを開始する関数
  function startTimer(seconds = 30) {
    // 前のタイマーがある場合はクリア
    clearInterval(timerInterval);
    
    // 新たにタイマーを設定
    timeLeft = seconds;
    timerValue.textContent = timeLeft;
    
    timerInterval = setInterval(() => {
      timeLeft--;
      timerValue.textContent = timeLeft;
      
      if (timeLeft <= 10) {
        timerValue.style.color = '#ff0000';
      }
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        answerStatusText.textContent = '時間切れです';
        // 時間切れでも選択状態は維持
      }
    }, 1000);
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    clearInterval(timerInterval);
    timerValue.style.color = '#ff5555'; // 色をリセット
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
      
      // 現在の問題データを保存
      currentQuizData = quizData;
      
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
          
          // 問題3の場合はアスペクト比を保持するクラスを追加
          if (parseInt(quizId) === 3) {
            button.classList.add('preserve-ratio');
          }
          
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
    if (timeLeft <= 0) return; // 時間切れの場合は回答を受け付けない
    
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
        button.classList.remove('selected');
        if (button.dataset.answer === answer) {
          button.classList.add('selected');
        }
      });
    } else {
      // テキスト選択肢の場合
      const optionButtons = optionsContainer.querySelectorAll('.option-button');
      optionButtons.forEach(button => {
        button.classList.remove('selected');
        if (button.textContent === answer) {
          button.classList.add('selected');
        }
      });
    }
    
    // タイマーを停止
    stopTimer();
    
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
  
  // 解答結果を表示
  function showAnswerResult(quizId) {
    if (!quizId || !currentQuizData) return;
    
    const playerAnswer = playerAnswers[quizId];
    if (!playerAnswer) return;
    
    // 正解/不正解のステータス表示
    if (playerAnswer.isCorrect) {
      resultStatus.textContent = '正解！';
      resultStatus.className = 'correct';
    } else {
      resultStatus.textContent = '不正解...';
      resultStatus.className = 'incorrect';
    }
    
    // 選択肢を表示
    resultOptions.innerHTML = '';
    
    // 画像選択肢かどうかを判断
    const isImageOptions = currentQuizData.is_image_options === 1;
    
    if (isImageOptions) {
      // 画像選択肢の場合はテキスト表示に変換（シンプルに）
      currentQuizData.options.forEach((_, index) => {
        const optionNumber = index + 1;
        const optionDiv = document.createElement('div');
        optionDiv.className = 'result-option';
        
        // 正解または選択された回答を強調表示
        if (currentQuizData.correct_answer === optionNumber.toString()) {
          optionDiv.classList.add('correct');
        } else if (playerAnswer.answer === optionNumber.toString() && !playerAnswer.isCorrect) {
          optionDiv.classList.add('incorrect');
        }
        
        optionDiv.textContent = `選択肢 ${optionNumber}`;
        resultOptions.appendChild(optionDiv);
      });
    } else {
      // テキスト選択肢の場合
      currentQuizData.options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'result-option';
        
        // 正解または選択された回答を強調表示
        if (option === currentQuizData.correct_answer) {
          optionDiv.classList.add('correct');
        } else if (option === playerAnswer.answer && !playerAnswer.isCorrect) {
          optionDiv.classList.add('incorrect');
        }
        
        optionDiv.textContent = option;
        resultOptions.appendChild(optionDiv);
      });
    }
    
    // 解説を取得して表示
    fetch(`/api/admin/quiz/${quizId}/answer`)
      .then(response => response.json())
      .then(data => {
        answerExplanation.textContent = data.explanation || '';
      })
      .catch(error => {
        console.error('解説の取得に失敗しました:', error);
        answerExplanation.textContent = '';
      });
    
    // 解答結果画面を表示
    showScreen(answerResultScreen);
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
        
        if (playerPosition <= 5) {
          rankingMessage = `おめでとうございます！あなたは${playerPosition}位です！景品があるので、指示がありましたら前に来てください！`;
          rankingPosition.className = 'ranking-position winner';
        } else {
          rankingMessage = '自分の順位が知りたい方は、新郎まで！一緒に遊んでくれてありがとう！';
          rankingPosition.className = 'ranking-position normal';
        }
        
        rankingPosition.textContent = rankingMessage;
      } else {
        rankingPosition.textContent = 'ランキングデータが取得できませんでした';
        rankingPosition.className = 'ranking-position normal';
      }
      
      // 結果画面を表示
      showScreen(resultScreen);
      
    } catch (error) {
      console.error('ランキングの取得に失敗しました:', error);
      rankingPosition.textContent = 'ランキングデータの取得に失敗しました';
      rankingPosition.className = 'ranking-position normal';
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
          // クイズ開始時の処理 - 説明画面を表示
          showScreen(explanationScreen);
          break;
          
        case 'show_question':
          // 問題表示の準備
          if (quizId) {
            currentQuizId = quizId;
            // 待機画面を表示
            showScreen(waitingScreen);
          }
          break;
          
        case 'next_slide':
          // displayが問題画面に移行した場合、問題を表示
          if (currentQuizId) {
            fetchAndShowQuestion(currentQuizId);
          }
          break;
          
        case 'show_answer':
          // 解答表示時の処理
          stopTimer(); // タイマーを確実に停止
          if (currentQuizId) {
            showAnswerResult(currentQuizId);
          }
          break;
          
        case 'show_ranking':
          // ランキング表示の処理
          fetchAndShowRanking();
          break;
          
        case 'reset_all':
          // リセット処理
          showScreen(registerScreen);
          break;
      }
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
  
  // Enterキーでも登録できるようにする
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      registerButton.click();
    }
  });
  
  // 初期画面を表示
  if (!urlPlayerId) {
    showScreen(registerScreen);
  }
});