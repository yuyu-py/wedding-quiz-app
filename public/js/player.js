// public/js/player.js
// 参加者画面用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 画面要素
  const registerScreen = document.getElementById('register-screen');
  const explanationScreen = document.getElementById('explanation-screen');
  const quizTitleScreen = document.getElementById('quiz-title-screen');
  const quizScreen = document.getElementById('quiz-screen');
  const answeredScreen = document.getElementById('answered-screen');
  const answerResultScreen = document.getElementById('answer-result-screen');
  const practiceScreen = document.getElementById('practice-screen');
  const rankingWaitingScreen = document.getElementById('ranking-waiting-screen');
  const resultScreen = document.getElementById('result-screen');
  
  // フォーム要素
  const playerNameInput = document.getElementById('player-name');
  const registerButton = document.getElementById('register-button');
  const displayName = document.getElementById('display-name');
  
  // クイズ要素
  const titleQuestionNumber = document.getElementById('title-question-number');
  const questionNumber = document.getElementById('question-number');
  const questionText = document.getElementById('question-text');
  const timerValue = document.getElementById('timer-value');
  const optionsContainer = document.getElementById('options-container');
  const answerStatusText = document.getElementById('answer-status-text');
  const yourAnswer = document.getElementById('your-answer');
  
  // 答え合わせ要素
  const answerResultHeader = document.getElementById('answer-result-header');
  const correctAnswer = document.getElementById('correct-answer');
  const answerOptionsContainer = document.getElementById('answer-options-container');
  const answerNoteText = document.getElementById('answer-note-text');
  
  // 問題画像と解答画像コンテナ
  const playerQuestionImage = document.getElementById('player-question-image');
  const playerAnswerImage = document.getElementById('player-answer-image');
  
  // 結果要素
  const waitingCorrectCount = document.getElementById('waiting-correct-count');
  const waitingTotalTime = document.getElementById('waiting-total-time');
  const correctCount = document.getElementById('correct-count');
  const totalTime = document.getElementById('total-time');
  const topRankDisplay = document.getElementById('top-rank-display');
  const rankNumber = document.getElementById('rank-number');
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
  let quizData = {}; // 現在の問題データを保存
  let playerRanking = 0; // プレイヤーの順位
  let displayCurrentScreen = ''; // メイン画面の現在の状態
  let answerCheckInterval = null; // 答え確認用の間隔タイマー
  let isTransitioning = false; // 画面遷移中フラグ
  let currentScreen = null; // 現在表示中の画面
  let timerStarted = false; // タイマーが開始されたかのフラグ
  let serverTimeOffset = 0; // サーバーとクライアントの時差
  
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
    explanationScreen.classList.add('hidden');
    quizTitleScreen.classList.add('hidden');
    quizScreen.classList.add('hidden');
    answeredScreen.classList.add('hidden');
    answerResultScreen.classList.add('hidden');
    rankingWaitingScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    if (practiceScreen) practiceScreen.classList.add('hidden');
    
    // 指定された画面を表示
    screen.classList.remove('hidden');
    currentScreen = screen;
    
    // 画面遷移時に一番上にスクロール
    window.scrollTo(0, 0);
    
    console.log(`Player: 画面を切り替えました: ${screen.id}`);
  }
  
  // タイマーを更新する関数（シンプル化）
  function updateTimer() {
    timeLeft--;
    timerValue.textContent = timeLeft;
    
    // カウントダウン状態表示を調整
    if (timeLeft <= 10) {
      timerValue.style.color = '#ffffff';
      timerValue.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
      timerValue.style.fontWeight = '900';
    } else {
      timerValue.style.color = '#ffffff';
      timerValue.style.textShadow = 'none';
      timerValue.style.fontWeight = '700';
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerStarted = false;
      answerStatusText.textContent = '時間切れです';
      
      // 自動的に答え合わせ画面への遷移を試みる
      tryShowAnswerResult();
    }
  }
  
  // タイマーを開始する関数（シンプル化）
  function startTimer(seconds = 30) {
    // 既存のタイマーをクリア
    stopTimer();
    
    // 初期値設定
    timeLeft = seconds;
    timerValue.textContent = timeLeft;
    timerStarted = true;
    
    console.log(`Player: タイマー開始 ${seconds}秒`);
    
    // シンプルな1秒間隔の更新
    timerInterval = setInterval(updateTimer, 1000);
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      console.log('Player: タイマーを停止しました');
    }
    timerStarted = false;
  }
  
  // 時間切れ時に答え合わせ画面への遷移を試みる
  async function tryShowAnswerResult() {
    if (!currentQuizId) return;
    
    // 既存の定期確認を停止
    clearInterval(answerCheckInterval);
    
    try {
      // サーバーに答えが公開されているか確認
      const response = await fetch(`/api/quiz/${currentQuizId}/answer-status`);
      const result = await response.json();
      
      if (result.available) {
        // 答えが公開されている場合は即座に答え合わせ画面に遷移
        console.log("答えが公開されています。答え合わせ画面に遷移します。");
        showAnswerResult(currentQuizId);
      } else {
        // 答えがまだ公開されていない場合は2秒ごとに再確認
        console.log("答えはまだ公開されていません。定期的に確認を開始します。");
        
        answerCheckInterval = setInterval(async () => {
          try {
            const checkResponse = await fetch(`/api/quiz/${currentQuizId}/answer-status`);
            const checkResult = await checkResponse.json();
            
            if (checkResult.available) {
              clearInterval(answerCheckInterval);
              console.log("答えが公開されました。答え合わせ画面に遷移します。");
              showAnswerResult(currentQuizId);
            }
          } catch (error) {
            console.error('答え確認中にエラーが発生しました:', error);
          }
        }, 2000); // 2秒ごとに確認
      }
    } catch (error) {
      console.error('答え合わせ画面への遷移確認中にエラーが発生しました:', error);
      
      // エラーが発生した場合も定期確認を開始
      answerCheckInterval = setInterval(async () => {
        try {
          const checkResponse = await fetch(`/api/quiz/${currentQuizId}/answer-status`);
          const checkResult = await checkResponse.json();
          
          if (checkResult.available) {
            clearInterval(answerCheckInterval);
            showAnswerResult(currentQuizId);
          }
        } catch (error) {
          console.error('答え確認中にエラーが発生しました:', error);
        }
      }, 2000);
    }
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
        if (displayName) {
          displayName.textContent = playerName;
        }
        
        // Socket.io接続を開始
        initSocketConnection();
        
        // 回答履歴を取得
        fetchPlayerAnswers();
        
        // 待機画面を表示 - 初期画面は説明画面
        showScreen(explanationScreen);
        
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
      console.log('回答履歴取得開始 - プレイヤーID:', playerId);
      const response = await fetch(`/api/player/${playerId}/answers`);
      const data = await response.json();
      
      console.log('回答履歴取得結果:', data);
      
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
        console.log('統計情報更新:', data.stats);
        
        // 正答数
        if (correctCount) {
          correctCount.textContent = data.stats.correctCount.toString();
        }
        if (waitingCorrectCount) {
          waitingCorrectCount.textContent = data.stats.correctCount.toString();
        }
        
        // ミリ秒から秒に変換して小数点2桁まで表示
        const seconds = (data.stats.totalResponseTime / 1000).toFixed(2);
        
        if (totalTime) {
          totalTime.textContent = seconds;
        }
        if (waitingTotalTime) {
          waitingTotalTime.textContent = seconds;
        }
        
        console.log('DOM更新完了 - 正答数:', data.stats.correctCount, '合計時間:', seconds);
      }
      
      return data;
      
    } catch (error) {
      console.error('回答履歴の取得に失敗しました:', error);
    }
  }
  
  // クイズの問題を取得して表示
  async function fetchAndShowQuestion(quizId) {
    if (!quizId) return;
    
    try {
      console.log(`Player: 問題${quizId}データ取得を開始`);
      
      // タイマーを必ず停止してリセット
      stopTimer();
      timeLeft = 30;
      timerValue.textContent = '30';
      
      console.log('Player: 問題切り替えでタイマーリセット完了');
      
      const response = await fetch(`/api/quiz/${quizId}`);
      const newQuizData = await response.json();
      quizData = newQuizData;
      
      console.log(`Player: 問題${quizId}データ取得完了:`, quizData);
      
      // 問題番号と問題文を設定
      questionNumber.textContent = `問題 ${quizId}`;
      questionText.textContent = newQuizData.question;
      
      // 問題画像コンテナを初期化
      const questionId = parseInt(quizId);
      
      // 問題画像を完全に初期化
      playerQuestionImage.innerHTML = '';
      playerQuestionImage.classList.add('hidden');
      
      // 問題1と2のみ画像を表示
      if (questionId === 1 || questionId === 2) {
        if (newQuizData.question_image_path) {
          // 画像要素を動的に作成
          const imgElement = document.createElement('img');
          imgElement.src = newQuizData.question_image_path;
          imgElement.alt = '問題画像';
          
          // コンテナに追加して表示
          playerQuestionImage.appendChild(imgElement);
          playerQuestionImage.classList.remove('hidden');
        }
      }
      
      // 既に回答済みかチェック
      if (playerAnswers[quizId]) {
        // 回答済みの場合は回答待機画面を表示
        yourAnswer.textContent = playerAnswers[quizId].answer;
        console.log(`Player: 問題${quizId}は既に回答済み - 待機画面に遷移`);
        showScreen(answeredScreen);
        return;
      }
      
      // 問題表示時刻を記録
      quizStartTimes[quizId] = new Date().getTime();
      
      // 画像選択肢かどうかを判断
      const isImageOptions = newQuizData.is_image_options === 1;
      
      // 選択肢を表示
      optionsContainer.innerHTML = '';
      
      console.log(`Player: 問題${quizId}選択肢タイプ:`, isImageOptions ? '画像選択肢' : 'テキスト選択肢');
      
      if (isImageOptions) {
        // 画像選択肢の場合
        optionsContainer.className = 'image-options-container';
        
        newQuizData.options.forEach((option, index) => {
          const button = document.createElement('button');
          button.className = 'image-option-button';
          button.dataset.answer = (index + 1).toString();
          
          // 問題3のみ、画像のアスペクト比を保持するクラスを追加
          if (parseInt(quizId) === 3) {
            button.classList.add('preserve-aspect-ratio');
          }
          
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
        
        newQuizData.options.forEach(option => {
          const button = document.createElement('button');
          button.className = 'option-button';
          button.textContent = option;
          
          // 問題5（新郎/新婦）の場合は色付け
          if (parseInt(quizId) === 5) {
            if (option === '新郎') {
              button.style.backgroundColor = '#e6f0ff';
              button.style.borderColor = '#0066cc';
              button.style.color = '#0066cc';
            } else if (option === '新婦') {
              button.style.backgroundColor = '#ffebf2';
              button.style.borderColor = '#cc3366';
              button.style.color = '#cc3366';
            }
          }
          
          button.addEventListener('click', () => selectAnswer(option, quizId));
          optionsContainer.appendChild(button);
        });
      }
      
      // 選択された答えをリセット
      selectedAnswer = null;
      answerStatusText.textContent = '回答を選択してください';

      // クイズ画面を表示
      showScreen(quizScreen);
      console.log('Player: 問題画面に遷移完了、タイマー準備OK');
      
      // タイマーはサーバーからのイベントで開始される
      
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
    }
  }
  
  // 回答を選択する処理
  async function selectAnswer(answer, quizId) {
    if (playerAnswers[quizId]) {
      console.log(`Player: 問題${quizId}は既に回答済みです`);
      return; // 既に回答済み
    }
    
    if (timeLeft <= 0) {
      console.log(`Player: 問題${quizId}は時間切れです`);
      return; // 時間切れの場合は回答不可
    }
    
    console.log(`Player: 問題${quizId}に「${answer}」を回答`);
    
    // 選択した答えを保存
    selectedAnswer = answer;
    
    // 回答時刻と経過時間を計算
    const answerTime = new Date().getTime();
    // クイズ表示時刻がない場合は現在時刻から30秒前に設定
    const startTime = quizStartTimes[quizId] || (answerTime - 30000);
    const responseTime = answerTime - startTime;
    
    console.log(`Player: 回答時間計算 - 開始:${startTime}, 回答:${answerTime}, 経過:${responseTime}ms`);
    
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
      console.log(`Player: 回答をサーバーに送信`);
      
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
      
      console.log(`Player: 回答送信結果:`, result);
      
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
  
  // 答え合わせ画面を表示
  async function showAnswerResult(quizId) {
    if (!quizId) return;
    
    // 遷移中フラグをセット（重複呼び出し防止）
    if (isTransitioning) {
      console.log('Player: 画面遷移中のため、重複した呼び出しを無視します');
      return;
    }
    isTransitioning = true;
    
    // 既存の定期確認を停止
    if (answerCheckInterval) {
      clearInterval(answerCheckInterval);
      answerCheckInterval = null;
    }
    
    console.log(`Player: 答え合わせ画面表示開始: クイズID ${quizId}`);
    
    try {
      // クイズの正解情報を取得
      const response = await fetch(`/api/admin/quiz/${quizId}/answer`);
      
      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status}`);
      }
      
      const answerData = await response.json();
      console.log(`Player: 答え情報取得成功:`, answerData);
      
      // 選択肢をJSON文字列から配列に変換
      const options = answerData.options;
      const correctAnswerText = answerData.correct_answer;
      
      // ユーザーの回答を確認
      const playerAnswer = playerAnswers[quizId]?.answer || null;
      const isCorrect = playerAnswers[quizId]?.isCorrect || false;
      
      console.log(`Player: 回答確認 - プレイヤー回答:${playerAnswer}, 正解:${correctAnswerText}, 正誤:${isCorrect}`);
      
      // ヘッダーを設定
      answerResultHeader.innerHTML = '';
      const resultIcon = document.createElement('span');
      resultIcon.className = 'material-symbols-rounded';
      
      if (playerAnswer === null) {
        // 回答なしの場合の処理
        answerResultHeader.className = 'answer-result-header no-answer';
        resultIcon.textContent = 'timer_off';
        answerResultHeader.appendChild(resultIcon);
        answerResultHeader.appendChild(document.createTextNode(' 時間切れ'));
      } else if (isCorrect) {
        answerResultHeader.className = 'answer-result-header correct';
        resultIcon.textContent = 'check_circle';
        answerResultHeader.appendChild(resultIcon);
        answerResultHeader.appendChild(document.createTextNode(' 正解！'));
      } else {
        answerResultHeader.className = 'answer-result-header incorrect';
        resultIcon.textContent = 'cancel';
        answerResultHeader.appendChild(resultIcon);
        answerResultHeader.appendChild(document.createTextNode(' 不正解'));
      }
      
      // 正解テキストを設定
      correctAnswer.textContent = correctAnswerText;
      
      // 画像選択肢かどうかを判断
      const isImageOptions = answerData.is_image_options === 1;
      
      // 選択肢コンテナをクリア
      answerOptionsContainer.innerHTML = '';
      
      console.log(`Player: 答え合わせ - 選択肢タイプ:`, isImageOptions ? '画像選択肢' : 'テキスト選択肢');
      
      if (isImageOptions) {
        // 画像選択肢の場合
        options.forEach((option, index) => {
          const optionNumber = (index + 1).toString();
          const isPlayerChoice = playerAnswer === optionNumber;
          const isCorrectOption = correctAnswerText === optionNumber;
          
          const optionDiv = document.createElement('div');
          optionDiv.className = 'answer-image-option';
          
          // 問題3のみ、画像のアスペクト比を保持するクラスを追加
          if (parseInt(quizId) === 3) {
            optionDiv.classList.add('preserve-aspect-ratio');
          }
          
          if (isCorrectOption) {
            optionDiv.classList.add('correct');
          }
          
          if (isPlayerChoice && !isCorrectOption) {
            optionDiv.classList.add('incorrect');
          }
          
          if (isPlayerChoice) {
            optionDiv.classList.add('your-choice');
          }
          
          const img = document.createElement('img');
          img.src = option;
          img.alt = `選択肢 ${optionNumber}`;
          
          const label = document.createElement('div');
          label.className = 'option-label';
          label.textContent = `選択肢 ${optionNumber}`;
          
          optionDiv.appendChild(img);
          optionDiv.appendChild(label);
          answerOptionsContainer.appendChild(optionDiv);
        });
      } else {
        // テキスト選択肢の場合
        options.forEach(option => {
          const isPlayerChoice = playerAnswer === option;
          const isCorrectOption = correctAnswerText === option;
          
          const optionDiv = document.createElement('div');
          optionDiv.className = 'answer-option';
          optionDiv.textContent = option;
          
          // 問題5（新郎/新婦）の場合は色付け
          if (parseInt(quizId) === 5) {
            if (option === '新郎') {
              optionDiv.style.backgroundColor = '#e6f0ff';
              optionDiv.style.borderColor = '#0066cc';
              optionDiv.style.color = '#0066cc';
            } else if (option === '新婦') {
              optionDiv.style.backgroundColor = '#ffebf2';
              optionDiv.style.borderColor = '#cc3366';
              optionDiv.style.color = '#cc3366';
            }
          }
          
          if (isCorrectOption) {
            optionDiv.classList.add('correct');
          }
          
          if (isPlayerChoice && !isCorrectOption) {
            optionDiv.classList.add('incorrect');
          }
          
          if (isPlayerChoice) {
            optionDiv.classList.add('your-choice');
          }
          
          answerOptionsContainer.appendChild(optionDiv);
        });
      }
      
      // 答え画像コンテナを初期化（問題1と2以外は常に非表示）
      const questionId = parseInt(quizId);
      
      // 答え画像を完全に初期化
      playerAnswerImage.innerHTML = '';
      playerAnswerImage.classList.add('hidden');
      
      // 問題1と2のみ答え画像を表示
      if (questionId === 1 || questionId === 2) {
        if (answerData.answer_image_path) {
          // 画像要素を動的に作成
          const imgElement = document.createElement('img');
          imgElement.src = answerData.answer_image_path;
          imgElement.alt = '解答画像';
          
          // コンテナに追加して表示
          playerAnswerImage.appendChild(imgElement);
          playerAnswerImage.classList.remove('hidden');
        }
      }
      
      // 説明文を追加
      answerNoteText.textContent = answerData.explanation || '';
      
      // 答え合わせ画面を表示
      showScreen(answerResultScreen);
      console.log(`Player: 答え合わせ画面表示完了`);
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('Player: 答え合わせ画面表示中にエラーが発生:', error);
      
      // エラー時のリトライ処理
      let retryCount = parseInt(localStorage.getItem(`retry_count_${quizId}`) || "0");
      retryCount++;
      
      if (retryCount <= 3) {
        localStorage.setItem(`retry_count_${quizId}`, retryCount.toString());
        console.log(`Player: エラー発生のため ${retryCount}/3 回目のリトライを実行します`);
        
        // 遷移フラグをリセット
        isTransitioning = false;
        
        setTimeout(() => {
          showAnswerResult(quizId);
        }, 1000 * retryCount); // 回数に応じて待機時間を延長
      } else {
        console.error('Player: 最大リトライ回数を超えました');
        // エラーメッセージを表示するなどの代替処理
        
        // 遷移フラグをリセット
        isTransitioning = false;
      }
    }
  }
    
  // プレイヤーのランキングを取得して表示
  async function fetchAndShowRanking() {
    if (!playerId) return;
    
    try {
      // 回答履歴を最新に更新
      await fetchPlayerAnswers();
      
      console.log("Player: fetchAndShowRanking実行中 - ランキングデータ取得前");
      
      // ランキング全体を取得
      const response = await fetch('/api/quiz/ranking/all');
      const rankings = await response.json();
      
      console.log('Player: 取得したランキングデータ:', rankings);
      console.log('Player: 現在のプレイヤーID:', playerId);
      
      // 自分の順位を探す
      let playerRanking = null;
      let playerPosition = 0;
      
      for (let i = 0; i < rankings.length; i++) {
        if (rankings[i].player_id === playerId) {
          playerRanking = rankings[i];
          playerPosition = i + 1;
          console.log('Player: プレイヤーランキング情報を発見:', playerRanking, '順位:', playerPosition);
          break;
        }
      }
  
      // ランキング情報を表示
      if (playerRanking) {
        console.log('Player: プレイヤーランキング情報を表示します');
        
        // 正答数 - 直接DOM要素に設定
        if (correctCount) {
          correctCount.textContent = playerRanking.correct_count.toString();
          console.log('Player: 正答数セット:', playerRanking.correct_count);
        }
        
        if (waitingCorrectCount) {
          waitingCorrectCount.textContent = playerRanking.correct_count.toString();
          console.log('Player: 待機画面正答数セット:', playerRanking.correct_count);
        }
        
        // ミリ秒から秒に変換して表示（小数点2桁）
        const seconds = (playerRanking.total_time / 1000).toFixed(2);
        
        if (totalTime) {
          totalTime.textContent = seconds;
          console.log('Player: 合計時間セット:', seconds);
        }
        
        if (waitingTotalTime) {
          waitingTotalTime.textContent = seconds;
          console.log('Player: 待機画面合計時間セット:', seconds);
        }
        
        // 順位を設定
        console.log('Player: 順位設定:', playerPosition);
        
        // 大きな順位表示
        if (rankNumber) {
          rankNumber.textContent = playerPosition.toString();
        }
        
        // ランキングメッセージ
        let rankingMessage = '';
        
        if (playerPosition <= 5) {
          // 上位5位以内のスタイルを適用
          if (topRankDisplay) {
            topRankDisplay.classList.remove('hidden');
            topRankDisplay.style.color = '#ffc107'; // 金色
            console.log('Player: 上位表示を有効化');
          }
          rankingMessage = `おめでとうございます！あなたは${playerPosition}位です！景品があるので、指示がありましたら前に来てください！`;
        } else {
          // 5位以下の表示スタイルを適用
          if (topRankDisplay) {
            topRankDisplay.classList.remove('hidden');
            topRankDisplay.style.color = '#333333'; // 黒色
            console.log('Player: 5位以下の順位表示');
          }
          rankingMessage = `あなたは${playerPosition}位でした。ご参加ありがとうございました！`;
        }
        
        if (rankingPosition) {
          rankingPosition.textContent = rankingMessage;
          console.log('Player: ランキングメッセージセット:', rankingMessage);
        }
      } else {
        console.warn('Player: ランキング内にプレイヤーが見つかりません。playerId:', playerId);
        if (rankingPosition) {
          rankingPosition.textContent = 'ランキングデータが取得できませんでした';
        }
      }
      
      // 待機画面を表示
      showScreen(rankingWaitingScreen);
      
    } catch (error) {
      console.error('Player: ランキングの取得に失敗しました:', error);
      if (rankingPosition) {
        rankingPosition.textContent = 'ランキングデータの取得に失敗しました';
      }
      showScreen(rankingWaitingScreen);
    }
  }
  
  // Socket.io接続の初期化
  let socket;
  function initSocketConnection() {
    if (socket) return; // 既に接続済み
    
    socket = io();
    
    // 接続時の処理
    socket.on('connect', () => {
      console.log('Player: Socket.io に接続しました');
      // プレイヤーとして登録
      socket.emit('register', { type: 'player', playerId });
    });
    
    // 登録完了時の処理
    socket.on('registered', (data) => {
      console.log('Player: 登録が完了しました:', data);
    });
    
    // タイマー準備イベント処理
    socket.on('timer_prepare', (data) => {
      const { quizId } = data;
      
      console.log(`Player: タイマー準備イベント受信: クイズ ${quizId}`);
      
      // 条件チェック
      if (currentQuizId === quizId && currentScreen === quizScreen) {
        console.log('Player: タイマー準備OK - 現在問題画面を表示中');
        
        // タイマー表示を初期化
        timeLeft = 30;
        timerValue.textContent = '30';
        
        // スタイルをリセット
        timerValue.style.color = '#ffffff';
        timerValue.style.textShadow = 'none';
        timerValue.style.fontWeight = '700';
      } else {
        console.log(`Player: タイマー準備条件不一致 - ID:${currentQuizId}, 画面:${currentScreen.id}`);
      }
    });
    
    // タイマー開始イベント処理
    socket.on('timer_start', (data) => {
      const { quizId, duration } = data;
      
      console.log(`Player: タイマー開始イベント受信: クイズ ${quizId} - ${duration}秒`);
      console.log(`Player: 現在の画面:`, currentScreen?.id);
      
      // タイマー開始処理
      if (currentQuizId === quizId) {
        console.log('Player: クイズIDが一致 - タイマー開始');
        
        // 現在の画面が問題画面の場合のみタイマーを開始
        if (currentScreen === quizScreen) {
          // タイマーを開始
          startTimer(duration);
          console.log('Player: タイマー開始完了');
        } else {
          console.log(`Player: 画面不一致 - 現在の画面:`, currentScreen?.id);
        }
      } else {
        console.log(`Player: クイズID不一致 - 現在:${currentQuizId}, 要求:${quizId}`);
      }
    });
    
    // 強制遷移イベントハンドラ
    socket.on('force_transition', (data) => {
      const { quizId, target, timestamp } = data;
      console.log(`Player: 強制遷移指示受信: ${target} - クイズID: ${quizId}`);
      
      if (quizId !== currentQuizId) {
        console.log('Player: 現在のクイズIDと一致しないため無視します');
        return;
      }
      
      // 遷移先に応じた処理
      if (target === 'answer') {
        // タイマーを停止
        stopTimer();
        
        // 現在の画面に関わらず答え合わせ画面に強制遷移
        console.log('Player: サーバーからの指示により答え合わせ画面に強制遷移します');
        showAnswerResult(quizId);
        
        // 定期確認を停止
        if (answerCheckInterval) {
          clearInterval(answerCheckInterval);
          answerCheckInterval = null;
        }
      } else if (target === 'practice') {
        // タイマーを停止
        stopTimer();
        
        // 実践待機画面に遷移（存在する場合）
        if (practiceScreen) {
          console.log('Player: サーバーからの指示により実践待機画面に遷移します');
          showScreen(practiceScreen);
        } else {
          console.log('Player: 実践待機画面が存在しないため、現在の画面を維持します');
        }
      }
    });
    
    // クイズイベント処理
    socket.on('quiz_event', (data) => {
      const { event, quizId, position, auto, manual, resetTimer } = data;
      console.log('Player: イベント受信:', event, quizId, position, auto ? '自動遷移' : manual ? '手動遷移' : '');
      
      // タイマーリセットフラグがある場合はリセット処理
      if (resetTimer) {
        stopTimer();
        timeLeft = 30;
        if (timerValue) {
          timerValue.textContent = '30';
        }
        timerStarted = false;
        console.log('Player: イベントによるタイマーリセット実行');
      }
      
      switch (event) {
        case 'quiz_started':
          // クイズ開始時の処理（説明画面）
          displayCurrentScreen = 'explanation';
          showScreen(explanationScreen);
          console.log('Player: クイズ説明画面に遷移');
          break;
          
        case 'show_question':
          // 問題タイトル表示の準備
          if (quizId) {
            displayCurrentScreen = 'quiz_title';
            currentQuizId = quizId;
            titleQuestionNumber.textContent = `問題 ${quizId}`;
            showScreen(quizTitleScreen);
            
            // 回答履歴をリロード
            fetchPlayerAnswers().then(() => {
              console.log(`Player: 問題${quizId}の回答履歴を更新しました`);
            });
            
            console.log(`Player: 問題${quizId}のタイトル画面に遷移`);
          }
          break;
          
        case 'next_slide':
          // 問題タイトルから問題表示へ、または問題から解答へ
          if (displayCurrentScreen === 'quiz_title') {
            // ディスプレイが問題タイトルから問題表示へ
            console.log('Player: タイトル画面から問題画面へ遷移開始');
            displayCurrentScreen = 'quiz_question';
            
            // 問題画面を取得して表示
            fetchAndShowQuestion(currentQuizId)
              .then(() => {
                console.log('Player: 問題画面への遷移完了');
              })
              .catch(err => {
                console.error('Player: 問題表示エラー', err);
              });
          } 
          else if (displayCurrentScreen === 'quiz_question') {
            // ディスプレイが問題表示から解答表示へ
            displayCurrentScreen = 'quiz_answer';
            
            // すでに回答済みなら答え合わせ画面へ、そうでなければタイマーを停止
            if (playerAnswers[currentQuizId]) {
              console.log(`Player: 問題${currentQuizId}は回答済み - 答え合わせ画面へ遷移`);
              showAnswerResult(currentQuizId);
            } else {
              // まだ回答していない場合、タイマーを停止して時間切れとする
              stopTimer();
              answerStatusText.textContent = '時間切れです';
              // 答え合わせ画面に遷移
              console.log(`Player: 問題${currentQuizId}は未回答で時間切れ - 答え合わせ画面へ遷移`);
              showAnswerResult(currentQuizId);
            }
          }
          break;
          
        case 'prev_slide':
          // 戻る操作の処理
          if (displayCurrentScreen === 'quiz_question') {
            displayCurrentScreen = 'quiz_title';
            showScreen(quizTitleScreen);
            stopTimer(); // タイマーを停止
            console.log('Player: 問題画面からタイトル画面に戻りました');
          } 
          else if (displayCurrentScreen === 'quiz_answer') {
            displayCurrentScreen = 'quiz_question';
            
            // すでに回答済みなら回答後待機画面、まだなら回答画面に戻る
            if (playerAnswers[currentQuizId]) {
              showScreen(answeredScreen);
              console.log('Player: 答え合わせ画面から回答待機画面に戻りました');
            } else {
              fetchAndShowQuestion(currentQuizId);
              console.log('Player: 答え合わせ画面から問題画面に戻りました');
            }
          }
          break;
          
        case 'show_answer':
          // 解答表示時の処理 - これはforce_transitionイベントによって処理される場合もある
          if (currentQuizId) {
            displayCurrentScreen = 'quiz_answer';
            
            // 遷移が既に進行中でなければ答え合わせ画面に遷移
            if (!isTransitioning) {
              console.log(`Player: show_answer イベントにより答え合わせ画面に遷移します`);
              showAnswerResult(currentQuizId);
              
              // 定期確認がある場合は停止
              if (answerCheckInterval) {
                clearInterval(answerCheckInterval);
                answerCheckInterval = null;
              }
            } else {
              console.log('Player: 遷移中のため、show_answerイベントを無視します');
            }
          }
          break;
          
        case 'show_practice':
          // 実践待機画面の表示
          if (currentQuizId === '5' && practiceScreen) {
            displayCurrentScreen = 'practice';
            showScreen(practiceScreen);
            console.log('Player: 実践待機画面に遷移');
          } else {
            console.log('Player: 実践待機画面への遷移をスキップ');
          }
          break;
          
        case 'show_ranking':
          // ランキング表示の処理
          displayCurrentScreen = 'ranking';
          console.log('Player: ランキング表示イベント受信:', position);
          
          // ランキングデータを更新して表示
          fetchAndShowRanking().then(() => {
            if (position === 'all') {
              // 全表示になったら結果画面へ
              showScreen(resultScreen);
              console.log('Player: ランキング全表示画面に遷移');
            } else if (currentScreen !== rankingWaitingScreen && currentScreen !== resultScreen) {
              // 最初のランキング表示で待機画面へ
              console.log('Player: ランキング待機画面に遷移');
            }
          });
          break;
          
        case 'reset_all':
          // リセット処理
          location.reload(); // 画面をリロード
          console.log('Player: すべてリセットのためページをリロード');
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
    
    // テーブルナンバーを取得
    let tableNumber = null;
    const selectedTable = document.querySelector('input[name="table-number"]:checked');
    if (selectedTable) {
      tableNumber = selectedTable.value;
    }
    
    console.log(`Player: 登録開始 - 名前:${name}, テーブル:${tableNumber}`);
    
    try {
      const response = await fetch('/api/player/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          name,
          tableNumber 
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        playerId = result.playerId;
        playerName = result.name;
        
        console.log(`Player: 登録成功 - ID:${playerId}, 名前:${playerName}`);
        
        // URLに参加者IDを追加（リロード時に再利用できるように）
        const url = new URL(window.location);
        url.searchParams.set('id', playerId);
        window.history.replaceState({}, '', url);
        
        // プレイヤー名を表示
        if (displayName) {
          displayName.textContent = playerName;
        }
        
        // Socket.io接続を開始
        initSocketConnection();
        
        // わずかな遅延を追加して、登録アクションとの因果関係を明確にする
        setTimeout(() => {
          // 説明画面に切り替え
          showScreen(explanationScreen);
        }, 300); // 300ミリ秒の遅延
        
      } else {
        console.error('Player: 登録失敗 -', result.error);
        alert('登録に失敗しました: ' + result.error);
      }
    } catch (error) {
      console.error('Player: 登録処理中にエラー -', error);
      alert('登録処理中にエラーが発生しました');
    }
  });
  
  // Enterキーでの登録を無効化
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Enterキーの動作を無効化
      // registerButtonは呼び出さない
      console.log('Player: Enterキーの動作を無効化しました');
    }
  });
  
  // 初期画面を表示
  if (!urlPlayerId) {
    showScreen(registerScreen);
    console.log('Player: 初期画面（登録画面）を表示');
  }
});