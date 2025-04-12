// 参加者画面用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 画面要素
  const registerScreen = document.getElementById('register-screen');
  const waitingScreen = document.getElementById('waiting-screen');
  const explanationScreen = document.getElementById('explanation-screen');
  const quizTitleScreen = document.getElementById('quiz-title-screen');
  const quizScreen = document.getElementById('quiz-screen');
  const answeredScreen = document.getElementById('answered-screen');
  const resultScreen = document.getElementById('result-screen');
  
  // フォーム要素
  const playerNameInput = document.getElementById('player-name');
  const registerButton = document.getElementById('register-button');
  const displayName = document.getElementById('display-name');
  
  // クイズ要素
  const quizTitle = document.getElementById('quiz-title');
  const quizTitleMessage = document.getElementById('quiz-title-message');
  const questionNumber = document.getElementById('question-number');
  const questionText = document.getElementById('question-text');
  const timerValue = document.getElementById('timer-value');
  const optionsContainer = document.getElementById('options-container');
  const answerStatusText = document.getElementById('answer-status-text');
  const answerResult = document.getElementById('answer-result');
  const answersReview = document.getElementById('answers-review');
  
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
  let isTimerActive = false; // タイマーアクティブ状態の追跡
  
  // 問題ごとのメッセージ
  const quizMessages = {
    1: "画面が遷移したら、早押しできるよ！頑張って！",
    2: "わからない問題は、とにかく早くおそう！合ってれば上位に行けるかも。。。",
    3: "次は新婦についての問題！画像を見て答えてね！",
    4: "次は新郎についての問題！ビビッとくるかな〜",
    5: "次は実践問題！直感で選ぼう！"
  };
  
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
    quizTitleScreen.classList.add('hidden');
    quizScreen.classList.add('hidden');
    answeredScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    
    // 指定された画面を表示
    screen.classList.remove('hidden');
    
    // クイズ画面を非表示にしたときはタイマーを停止
    if (screen !== quizScreen && isTimerActive) {
      stopTimer();
    }
  }
  
  // タイマーを開始する関数
  function startTimer(seconds = 30) {
    // すでにタイマーが動いている場合は何もしない
    if (isTimerActive) return;
    
    clearInterval(timerInterval);
    timeLeft = seconds;
    timerValue.textContent = timeLeft;
    isTimerActive = true;
    
    timerInterval = setInterval(() => {
      timeLeft--;
      timerValue.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        isTimerActive = false;
        answerStatusText.textContent = '時間切れです';
      }
    }, 1000);
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    clearInterval(timerInterval);
    isTimerActive = false;
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
        // 回答済みの場合は回答待機画面を表示（回答結果を表示）
        showAnswerResult(quizId, quizData);
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
          
          // 問題3の場合は元の画像比率を維持
          if (parseInt(quizId) === 3) {
            img.style.objectFit = 'contain';
            button.style.height = 'auto';
            button.style.aspectRatio = '4/3';
          }
          
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
  
  // 回答結果を表示する関数
  async function showAnswerResult(quizId, quizData = null) {
    try {
      if (!quizData) {
        const response = await fetch(`/api/quiz/${quizId}`);
        quizData = await response.json();
      }
      
      // 正解情報を取得
      const answerResponse = await fetch(`/api/admin/quiz/${quizId}/answer`);
      const answerData = await answerResponse.json();
      const correctAnswer = answerData.correct_answer;
      
      // プレイヤーの回答
      const playerAnswer = playerAnswers[quizId];
      
      // 正解/不正解の表示
      answerResult.innerHTML = '';
      const resultText = document.createElement('p');
      
      if (playerAnswer.isCorrect) {
        answerResult.className = 'answer-result correct';
        resultText.textContent = '正解！';
      } else {
        answerResult.className = 'answer-result incorrect';
        resultText.textContent = '不正解';
      }
      
      answerResult.appendChild(resultText);
      
      // 選択肢のレビュー
      answersReview.innerHTML = '';
      
      // 画像選択肢かどうかを判断
      const isImageOptions = quizData.is_image_options === 1;
      
      if (isImageOptions) {
        // 画像選択肢の場合
        const optionNumber = parseInt(playerAnswer.answer);
        const correctOptionNumber = parseInt(correctAnswer);
        
        // テキストでの表示
        quizData.options.forEach((option, index) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'review-option';
          
          // 正解か選択肢か判定
          if (index + 1 === correctOptionNumber) {
            optionDiv.classList.add('correct');
          } else if (index + 1 === optionNumber && !playerAnswer.isCorrect) {
            optionDiv.classList.add('selected-incorrect');
          }
          
          const optionLabel = document.createElement('div');
          optionLabel.className = 'review-option-label';
          optionLabel.textContent = `選択肢 ${index + 1}`;
          
          optionDiv.appendChild(optionLabel);
          answersReview.appendChild(optionDiv);
        });
      } else {
        // テキスト選択肢の場合
        quizData.options.forEach(option => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'review-option';
          
          // 正解か選択肢か判定
          if (option === correctAnswer) {
            optionDiv.classList.add('correct');
          } else if (option === playerAnswer.answer && !playerAnswer.isCorrect) {
            optionDiv.classList.add('selected-incorrect');
          }
          
          const optionLabel = document.createElement('div');
          optionLabel.className = 'review-option-label';
          optionLabel.textContent = option;
          
          optionDiv.appendChild(optionLabel);
          answersReview.appendChild(optionDiv);
        });
      }
      
      // 回答待機画面を表示
      showScreen(answeredScreen);
      
    } catch (error) {
      console.error('回答結果の表示に失敗しました:', error);
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
      
      // 回答結果を表示
      const quizResponse = await fetch(`/api/quiz/${quizId}`);
      const quizData = await quizResponse.json();
      showAnswerResult(quizId, quizData);
      
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
        
        if (playerPosition <= 5) {
          rankingPosition.className = 'ranking-position top';
          rankingMessage = `おめでとうございます！あなたは${playerPosition}位です！景品があるので、指示がありましたら前に来てください！`;
        } else {
          rankingPosition.className = 'ranking-position other';
          rankingMessage = '自分の順位が知りたい方は、新郎まで！一緒に遊んでくれてありがとう！';
        }
        
        rankingPosition.textContent = rankingMessage;
      } else {
        rankingPosition.className = 'ranking-position other';
        rankingPosition.textContent = 'ランキングデータが取得できませんでした';
      }
      
      // 結果画面を表示
      showScreen(resultScreen);
      
    } catch (error) {
      console.error('ランキングの取得に失敗しました:', error);
      rankingPosition.className = 'ranking-position other';
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
          // クイズ開始時は説明画面を表示
          showScreen(explanationScreen);
          break;
          
        case 'show_question':
          // 問題タイトル表示の準備
          if (quizId) {
            currentQuizId = quizId;
            quizTitle.textContent = `問題 ${quizId}`;
            
            // 問題ごとのメッセージを設定
            if (quizMessages[quizId]) {
              quizTitleMessage.textContent = quizMessages[quizId];
            }
            
            // 問題タイトル画面を表示
            showScreen(quizTitleScreen);
          }
          break;
          
        case 'next_slide':
          // タイトル画面から問題画面へ、または問題画面から回答画面へ
          if (currentQuizId) {
            if (currentScreen === quizTitleScreen) {
              fetchAndShowQuestion(currentQuizId);
            } else if (currentScreen === quizScreen && !selectedAnswer) {
              // タイマーが終了していない場合は継続
              // タイマーがアクティブでない場合のみ次の画面へ
              if (!isTimerActive) {
                showScreen(answeredScreen);
              }
            }
          }
          break;
          
        case 'show_answer':
          // 解答表示時（すでに回答済み画面か結果画面にいる場合は何もしない）
          if (currentQuizId && currentScreen !== answeredScreen && currentScreen !== resultScreen) {
            stopTimer();
            // 回答していない場合は回答待機画面へ
            showScreen(answeredScreen);
          }
          break;
          
        case 'show_ranking':
          // ランキング表示の処理
          fetchAndShowRanking();
          break;
          
        case 'reset_all':
          // リセット処理
          location.reload(); // 画面をリロード
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
  
  // 初期画面を表示
  if (!urlPlayerId) {
    showScreen(registerScreen);
  }
});