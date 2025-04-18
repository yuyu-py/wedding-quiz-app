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
  const rankingWaitingScreen = document.getElementById('ranking-waiting-screen');
  const resultScreen = document.getElementById('result-screen');
  // 実践待機画面（問題5用）の参照を確認
  const practiceScreen = document.getElementById('practice-screen');
  
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
  let tableNumber = null;
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
  
  // タイマー精度向上のための変数
  let serverTimeOffset = 0;      // サーバーとの時間差
  let timerEndTime = 0;          // 終了時刻（ローカル時間）
  let lastDisplayedTime = 30;    // 最後に表示した時間（巻き戻り防止用）
  let nextScheduledSecond = 30;  // 次に表示する予定の秒数
  let timerStarted = false;      // タイマーが開始されたかのフラグ
  
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
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(s => s.classList.add('hidden'));
    
    // 指定された画面を表示
    screen.classList.remove('hidden');
    currentScreen = screen; // 現在の画面を更新
    
    // 画面遷移時に一番上にスクロール
    window.scrollTo(0, 0);
    
    console.log(`Player: 画面を切り替えました: ${screen.id}`);
  }
  
  // スタイル更新を関数化
  function updateTimerStyle(seconds) {
    if (seconds <= 10) {
      timerValue.style.color = '#ffffff';
      timerValue.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
      timerValue.style.fontWeight = '900';
    } else {
      timerValue.style.color = '#ffffff';
      timerValue.style.textShadow = 'none';
      timerValue.style.fontWeight = '700';
    }
  }
  
  // 精密なタイマー開始関数
  function startPreciseTimer() {
    // 既存のタイマーをクリア
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // 初期設定
    nextScheduledSecond = timeLeft - 1;
    timerStarted = true;
    
    // 高頻度更新タイマー（50ms間隔でさらに頻繁に）
    timerInterval = setInterval(() => {
      // 現在のローカル時間でタイマーを更新
      const now = Date.now();
      const remainingMs = Math.max(0, timerEndTime - now);
      const newTimeLeft = Math.ceil(remainingMs / 1000);
      
      // 次の秒に達したらのみ表示を更新（1秒ずつ確実に減少）
      if (newTimeLeft <= nextScheduledSecond) {
        // 次の秒に達した場合
        timeLeft = nextScheduledSecond;
        lastDisplayedTime = nextScheduledSecond;
        timerValue.textContent = nextScheduledSecond;
        
        console.log(`Player: 秒変更 - ${nextScheduledSecond}秒を表示`);
        
        // 次の目標秒数を設定
        nextScheduledSecond = Math.max(0, nextScheduledSecond - 1);
        
        // スタイル更新
        updateTimerStyle(timeLeft);
      }
      
      // タイマー終了処理
      if (remainingMs <= 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerStarted = false;
        timeLeft = 0;
        timerValue.textContent = '0';
        answerStatusText.textContent = '時間切れです';
      }
    }, 50); // 50msごとに更新（より高頻度に）
  }
  
  // 旧タイマー関数（互換性維持のため残す）
  function startTimer(seconds = 30) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    timerValue.textContent = timeLeft;
    
    console.log(`Player: 旧タイマー開始 ${seconds}秒`);
    
    timerInterval = setInterval(() => {
      timeLeft--;
      timerValue.textContent = timeLeft;
      
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
        timerStarted = false;
        answerStatusText.textContent = '時間切れです';
        
        // 自動的に答え合わせ画面への遷移を試みる
        tryShowAnswerResult();
      }
    }, 1000);
  }
  
  // タイマー停止関数
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerStarted = false;
    console.log('Player: タイマーを停止しました');
  }
  
  // 時間切れ時に答え合わせ画面への遷移を試みる
  async function tryShowAnswerResult(quizId) {
    if (!quizId) return;
    
    // 問題5は特殊対応するため自動チェックしない
    if (quizId === '5') {
      console.log('問題5は自動的な答え合わせを行いません');
      return;
    }
    
    // 既存の定期確認を停止
    clearInterval(answerCheckInterval);
    
    try {
      // サーバーに答えが公開されているか確認
      const response = await fetch(`/api/quiz/${quizId}/answer-status`);
      const result = await response.json();
      
      if (result.available) {
        // 答えが公開されている場合は即座に答え合わせ画面に遷移
        console.log(`問題${quizId}: 答えが公開されています。答え合わせ画面に遷移します。`);
        showAnswerResult(quizId);
      } else {
        // 答えがまだ公開されていない場合は2秒ごとに再確認
        console.log(`問題${quizId}: 答えはまだ公開されていません。定期的に確認を開始します。`);
        
        answerCheckInterval = setInterval(async () => {
          try {
            const checkResponse = await fetch(`/api/quiz/${quizId}/answer-status`);
            const checkResult = await checkResponse.json();
            
            if (checkResult.available) {
              clearInterval(answerCheckInterval);
              console.log(`問題${quizId}: 答えが公開されました。答え合わせ画面に遷移します。`);
              showAnswerResult(quizId);
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
          const checkResponse = await fetch(`/api/quiz/${quizId}/answer-status`);
          const checkResult = await checkResponse.json();
          
          if (checkResult.available) {
            clearInterval(answerCheckInterval);
            showAnswerResult(quizId);
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
        tableNumber = player.table_number;
        
        // プレイヤー名を表示
        displayName.textContent = playerName;
        
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
      // タイマーを必ず停止してリセット
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      timeLeft = 30;
      lastDisplayedTime = 30;
      nextScheduledSecond = 29;
      timerStarted = false;
      
      if (timerValue) {
        timerValue.textContent = '30';
      }
      
      console.log('Player: 問題切り替えでタイマーリセット完了');
      
      const response = await fetch(`/api/quiz/${quizId}`);
      const newQuizData = await response.json();
      quizData = newQuizData;
      
      // 問題番号と問題文を設定
      questionNumber.textContent = `問題 ${quizId}`;
      questionText.textContent = newQuizData.question;
      
      // 問題画像コンテナを初期化（問題1と2以外は常に非表示）
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
        showScreen(answeredScreen);
        return;
      }
      
      // 問題表示時刻を記録
      quizStartTimes[quizId] = new Date().getTime();
      
      // 画像選択肢かどうかを判断
      const isImageOptions = newQuizData.is_image_options === 1;
      
      // 選択肢を表示
      optionsContainer.innerHTML = '';
      
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
      
      // 現在のクイズIDを保存
      currentQuizId = quizId;
      
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
    }
  }
  
  // 回答を選択する処理
  async function selectAnswer(answer, quizId) {
    if (playerAnswers[quizId]) return; // 既に回答済み
    if (timeLeft <= 0) return; // 時間切れの場合は回答不可
    
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
      
      // 問題5では自動的な答え合わせをしない
      if (quizId === '5') {
        console.log('問題5: 回答後は制限時間終了を待ち、実践画面への遷移を待機します');
        // すべての自動チェックを無効化
        if (answerCheckInterval) {
          clearInterval(answerCheckInterval);
          answerCheckInterval = null;
        }
      } else {
        // 問題1-4では通常のタイマー終了を待機
        console.log(`問題${quizId}: 回答後は制限時間終了を待機します`);
      }
      
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
      console.log('画面遷移中のため、重複した呼び出しを無視します');
      return;
    }
    isTransitioning = true;
    
    // 既存の定期確認を停止
    if (answerCheckInterval) {
      clearInterval(answerCheckInterval);
      answerCheckInterval = null;
    }
    
    // 問題5用のデバッグログを追加
    if (quizId === '5') {
      console.log(`[DEBUG-Q5] 答え合わせ開始 - 事前状態: ${JSON.stringify({
        playerAnswer: playerAnswers[quizId]?.answer || 'なし',
        isCorrect: playerAnswers[quizId]?.isCorrect,
        currentQuizId: currentQuizId
      })}`);
    }
    
    console.log(`答え合わせ画面表示開始: クイズID ${quizId}`);
    
    try {
      // 問題5の場合は特別に解答公開チェック
      if (quizId === '5') {
        // 実践フェーズ後かつ解答公開状態を確認
        const statusResponse = await fetch(`/api/quiz/${quizId}/answer-status`);
        const statusResult = await statusResponse.json();
        
        if (!statusResult.available) {
          console.log('問題5: 解答がまだ公開されていません。実践画面に留まります。');
          isTransitioning = false;
          
          // 画面状態を確認して適切な画面を表示
          if (currentScreen !== practiceScreen) {
            showScreen(practiceScreen);
          }
          return;
        }
        
        console.log(`[DEBUG-Q5] 解答公開確認結果: ${JSON.stringify(statusResult)}`);
      }
      
      // クイズの正解情報を取得
      const response = await fetch(`/api/admin/quiz/${quizId}/answer`);
      
      // 問題5: レスポンスをデバッグ出力
      if (quizId === '5') {
        const responseClone = response.clone();
        const responseText = await responseClone.text();
        console.log(`[DEBUG-Q5] サーバーレスポンス: ${responseText}`);
      }
      
      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status}`);
      }
      
      const answerData = await response.json();
      
      // 問題5: 取得したデータを詳細に表示
      if (quizId === '5') {
        console.log(`[DEBUG-Q5] 正解データ: ${JSON.stringify(answerData)}`);
      }
      
      // 問題5で答えが空の場合は実践画面に留まる
      if (quizId === '5' && (!answerData.correct_answer || answerData.correct_answer === '')) {
        console.log('問題5: 解答が設定されていません。実践画面に留まります。');
        isTransitioning = false;
        showScreen(practiceScreen);
        return;
      }
      
      // 選択肢をJSON文字列から配列に変換
      const options = answerData.options;
      const correctAnswerText = answerData.correct_answer;
      
      // ユーザーの回答を確認
      const playerAnswer = playerAnswers[quizId]?.answer || null;
      const isCorrect = playerAnswers[quizId]?.isCorrect || false;
      
      // 問題5: 判定値を詳細に表示
      if (quizId === '5') {
        console.log(`[DEBUG-Q5] 判定検証: playerAnswer="${playerAnswer}", correctAnswer="${correctAnswerText}", isCorrect=${isCorrect}, playerAnswersオブジェクト=${JSON.stringify(playerAnswers[quizId])}`);
        
        // 直接比較してみる
        const directComparison = playerAnswer === correctAnswerText;
        console.log(`[DEBUG-Q5] 直接比較: ${directComparison} (${typeof playerAnswer} vs ${typeof correctAnswerText})`);
        
        // スペースやケースの違いも確認
        const normalizedPlayer = String(playerAnswer).trim();
        const normalizedCorrect = String(correctAnswerText).trim();
        console.log(`[DEBUG-Q5] 正規化後比較: "${normalizedPlayer}" === "${normalizedCorrect}" => ${normalizedPlayer === normalizedCorrect}`);
      }
      
      // 問題5の場合、最新の回答データをサーバーから取得
      if (quizId === '5') {
        console.log('[DEBUG-Q5] サーバーから最新の回答データを取得');
        try {
          const freshAnswerResponse = await fetch(`/api/player/${playerId}/answer/${quizId}`);
          if (freshAnswerResponse.ok) {
            const freshAnswerData = await freshAnswerResponse.json();
            console.log(`[DEBUG-Q5] 最新回答データ: ${JSON.stringify(freshAnswerData)}`);
            
            if (freshAnswerData.success && freshAnswerData.answer) {
              // 得られた最新データで正誤状態を上書き
              const serverIsCorrect = freshAnswerData.answer.is_correct === 1;
              console.log(`[DEBUG-Q5] サーバー上の正誤状態: ${serverIsCorrect}, ローカルの状態: ${isCorrect}`);
              
              if (serverIsCorrect !== isCorrect) {
                console.log(`[DEBUG-Q5] 正誤状態を更新: ${isCorrect} → ${serverIsCorrect}`);
                
                // クライアント側のキャッシュを更新
                if (playerAnswers[quizId]) {
                  playerAnswers[quizId].isCorrect = serverIsCorrect;
                  isCorrect = serverIsCorrect; // 現在の関数スコープの変数も更新
                }
              }
            }
          } else {
            console.log(`[DEBUG-Q5] 回答データ取得失敗: ${freshAnswerResponse.status}`);
          }
        } catch (refreshError) {
          console.error(`[ERROR-Q5] 最新回答データ取得エラー: ${refreshError.message}`);
        }
      }
      
      // 問題5: ヘッダー設定前にデバッグ
      if (quizId === '5') {
        console.log(`[DEBUG-Q5] ヘッダー設定前: answerResultHeader=${answerResultHeader.className}`);
      }
      
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
      
      // 問題5: ヘッダー設定後のデバッグ
      if (quizId === '5') {
        console.log(`[DEBUG-Q5] ヘッダー設定後: answerResultHeader=${answerResultHeader.className}`);
      }
      
      // 正解テキストを設定
      correctAnswer.textContent = correctAnswerText;
      
      // 画像選択肢かどうかを判断
      const isImageOptions = answerData.is_image_options === 1;
      
      // 選択肢コンテナをクリア
      answerOptionsContainer.innerHTML = '';
      
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
      
      // 問題5特別処理: データが不一致なら強制上書き
      if (quizId === '5') {
        console.log('[DEBUG-Q5] 問題5特別処理: 表示の強制修正チェック');
        
        // 選んだ回答が正解と同じなら「正解」表示に強制修正
        if (playerAnswer === correctAnswerText && !isCorrect) {
          console.log(`[DEBUG-Q5] 表示不一致を検出: 選択=${playerAnswer}, 正解=${correctAnswerText}だが不正解表示`);
          
          // ヘッダーを正解表示に強制修正
          answerResultHeader.className = 'answer-result-header correct';
          answerResultHeader.innerHTML = '';
          
          const correctIcon = document.createElement('span');
          correctIcon.className = 'material-symbols-rounded';
          correctIcon.textContent = 'check_circle';
          
          answerResultHeader.appendChild(correctIcon);
          answerResultHeader.appendChild(document.createTextNode(' 正解！（表示修正済）'));
          
          console.log(`[DEBUG-Q5] 表示を強制修正しました: ${answerResultHeader.className}`);
        }
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
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error(`[ERROR-Q5] 答え合わせ画面表示中にエラー: ${error.message}`);
      
      // エラー時のリトライ処理
      let retryCount = parseInt(localStorage.getItem(`retry_count_${quizId}`) || "0");
      retryCount++;
      
      if (retryCount <= 3) {
        localStorage.setItem(`retry_count_${quizId}`, retryCount.toString());
        console.log(`エラー発生のため ${retryCount}/3 回目のリトライを実行します`);
        
        // 遷移フラグをリセット
        isTransitioning = false;
        
        setTimeout(() => {
          showAnswerResult(quizId);
        }, 1000 * retryCount); // 回数に応じて待機時間を延長
      } else {
        console.error('最大リトライ回数を超えました');
        // エラーメッセージを表示するなどの代替処理
        
        // 遷移フラグをリセット
        isTransitioning = false;
      }
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
    
    // 精密なタイマー開始イベント処理
    socket.on('precise_timer_start', (data) => {
      const { quizId, startTime, endTime, duration, serverTime } = data;
      
      console.log(`Display: 精密タイマー開始イベント - クイズID ${quizId}, 持続時間 ${duration}秒`);
      console.log(`Display: 現在の画面: ${currentScreen.id}, 現在のクイズID: ${currentQuizId}`);
      
      // 問題5も含めて確実に処理
      if (currentQuizId === quizId && currentScreen === quizScreen) {
        // サーバーとの時間差を計算
        const receivedTime = Date.now();
        serverTimeOffset = serverTime - receivedTime;
        
        // 終了時刻をローカル時間に変換
        timerEndTime = endTime - serverTimeOffset;
        
        // タイマーをリセット
        stopTimer();
        timeLeft = duration;
        lastDisplayedTime = duration;
        nextScheduledSecond = duration - 1;
        timerValue.textContent = duration;
        
        // 精密なタイマー開始
        startPreciseTimer();
        
        console.log(`Display: タイマー開始 - ${duration}秒から開始、次は${nextScheduledSecond}秒`);
      } else {
        console.log(`Display: タイマー開始条件不一致 - 表示されません`);
      }
    });    
    
    // 精密なタイマー同期イベント処理
    socket.on('precise_timer_sync', (data) => {
      const { quizId, remaining, serverTime, secRemaining, isConfirmation } = data;
      
      if (currentQuizId === quizId && currentScreen === quizScreen) {
        // サーバーとの時間差を更新
        const receivedTime = Date.now();
        serverTimeOffset = serverTime - receivedTime;
        
        // 残り時間を秒に変換（切り上げ）
        const newTimeLeft = secRemaining || Math.ceil(remaining / 1000);
        
        console.log(`Player: 同期 - サーバー残り: ${newTimeLeft}秒, 現在表示: ${lastDisplayedTime}秒`);
        
        // 確認同期または20秒以下は強制的に同期
        if (isConfirmation || newTimeLeft <= 20) {
          timeLeft = newTimeLeft;
          lastDisplayedTime = newTimeLeft;
          timerValue.textContent = newTimeLeft;
          nextScheduledSecond = newTimeLeft - 1; // 次の秒数を設定
          
          console.log(`Player: 強制同期 - 表示を${newTimeLeft}秒に設定、次は${nextScheduledSecond}秒`);
        } 
        // 通常同期 - 表示の単調減少を維持
        else if (newTimeLeft < lastDisplayedTime) {
          timeLeft = newTimeLeft;
          lastDisplayedTime = newTimeLeft;
          timerValue.textContent = newTimeLeft;
          nextScheduledSecond = newTimeLeft - 1;
        }
        
        // 残り時間に応じたスタイル変更
        updateTimerStyle(newTimeLeft);
        
        // 終了時刻の更新
        timerEndTime = Date.now() + remaining;
      }
    });
    
    // 同期遷移イベント処理
    socket.on('synchronized_transition', (data) => {
      const { quizId, target, transitionTime, serverTime } = data;
      
      if (quizId === currentQuizId) {
        // サーバーとの時間差を計算
        const receivedTime = Date.now();
        serverTimeOffset = serverTime - receivedTime;
        
        // ローカル時間での遷移時刻を計算
        const localTransitionTime = transitionTime - serverTimeOffset;
        const waitTime = Math.max(0, localTransitionTime - receivedTime);
        
        console.log(`Player: 同期遷移イベント - 目標: ${target}, 待機時間: ${waitTime}ms`);
        
        // 指定された時刻まで待ってから遷移
        setTimeout(() => {
          console.log(`Player: 同期遷移実行 - ${target}`);
          
          if (target === 'question' && displayCurrentScreen === 'quiz_title') {
            displayCurrentScreen = 'quiz_question';
            fetchAndShowQuestion(currentQuizId);
          }
        }, waitTime);
      }
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
    
    // タイマー同期イベント（従来バージョン - 互換性維持）
    socket.on('timer_sync', (data) => {
      const { quizId, remainingTime } = data;
      
      // 精密タイマーが有効な場合は無視
      if (timerStarted) {
        return;
      }
      
      // 現在のクイズIDが一致する場合のみタイマーを同期
      if (currentQuizId === quizId && currentScreen === quizScreen) {
        // タイマーをリセットして残り時間から開始
        clearInterval(timerInterval);
        timeLeft = remainingTime;
        timerValue.textContent = timeLeft;
        
        if (timeLeft > 0) {
          // 新たなタイマーを開始
          timerInterval = setInterval(() => {
            timeLeft--;
            timerValue.textContent = timeLeft;
            
            if (timeLeft <= 10) {
              // 10秒以下で太字の白色テキスト
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
              answerStatusText.textContent = '時間切れです';
            }
          }, 1000);
        } else if (timeLeft <= 0) {
          // タイマーが0の場合は時間切れ表示
          answerStatusText.textContent = '時間切れです';
          clearInterval(timerInterval);
        }
      }
    });
    
    // 強制遷移イベント処理の修正
    socket.on('force_transition', (data) => {
      const { quizId, target, timestamp, isPractice, fromPractice, answer } = data;
      console.log(`強制遷移指示受信: ${target} - クイズID: ${quizId}, isPractice: ${isPractice}, fromPractice: ${fromPractice}`);
      
      // 問題5の特殊ケースを優先処理
      if (quizId === '5') {
        if (target === 'practice' && isPractice) {
          // 問題5の実践画面への強制遷移
          console.log('問題5: 実践待機画面に強制遷移します');
          stopTimer(); // タイマーを停止
          displayCurrentScreen = 'practice';
          showScreen(practiceScreen);
          return; // 処理を終了
        }
        
        if (target === 'answer' && fromPractice) {
          // 問題5の実践画面から解答画面への強制遷移
          console.log('問題5: 実践画面から解答画面に強制遷移します');
          displayCurrentScreen = 'quiz_answer';
          showAnswerResult('5');
          return; // 処理を終了
        }
      }
      
      // 以下は通常の遷移処理
      if (quizId !== currentQuizId && target !== 'ranking') {
        console.log('現在のクイズIDと一致しないため無視します');
        return;
      }
      
      // 遷移先に応じた処理
      if (target === 'answer') {
        // タイマーを停止
        stopTimer();
        
        // 答え合わせ画面に強制遷移
        console.log('サーバーからの指示により答え合わせ画面に強制遷移します');
        showAnswerResult(quizId);
        
        // 定期確認を停止
        if (answerCheckInterval) {
          clearInterval(answerCheckInterval);
          answerCheckInterval = null;
        }
      } else if (target === 'practice') {
        // タイマーを停止
        stopTimer();
        
        // 実践待機画面に遷移
        console.log('サーバーからの指示により実践待機画面に遷移します');
        displayCurrentScreen = 'practice';
        showScreen(practiceScreen);
      } else if (target === 'ranking') {
        // ランキング待機画面に遷移
        console.log('サーバーからの指示によりランキング待機画面に遷移します');
        fetchAndShowRanking()
          .then(() => {
            showScreen(rankingWaitingScreen);
          });
      }
    });
    
    // クイズイベント処理の修正
    socket.on('quiz_event', (data) => {
      const { event, quizId, position, auto, manual, fromPractice, isPractice, answer } = data;
      
      console.log(`イベント受信: ${event}, クイズID: ${quizId}, isPractice: ${isPractice}, fromPractice: ${fromPractice}`);
      
      // 問題5の特殊イベントを優先処理
      if (quizId === '5') {
        // 実践待機画面表示
        if (event === 'show_practice' && isPractice) {
          console.log('Player: 問題5の実践待機画面表示イベント受信');
          stopTimer(); // タイマーを停止
          displayCurrentScreen = 'practice';
          showScreen(practiceScreen);
          return; // 処理を終了
        }
        
        // 実践画面から解答画面への遷移
        if (event === 'show_answer' && fromPractice) {
          console.log('Player: 問題5の実践画面から解答画面への遷移イベント受信');
          displayCurrentScreen = 'quiz_answer';
          showAnswerResult('5');
          return; // 処理を終了
        }
      }
      
      // 以下は通常のイベント処理
      switch (event) {
        case 'quiz_started':
          // クイズ開始時の処理（説明画面）
          displayCurrentScreen = 'explanation';
          showScreen(explanationScreen);
          break;
          
        case 'show_question':
          // 問題タイトル表示の準備
          if (quizId) {
            displayCurrentScreen = 'quiz_title';
            currentQuizId = quizId;
            titleQuestionNumber.textContent = `問題 ${quizId}`;
            showScreen(quizTitleScreen);
            
            // 回答履歴をリロード
            fetchPlayerAnswers();
          }
          break;
          
        case 'next_slide':
          // 問題タイトルから問題表示へ、または問題から解答へ
          if (displayCurrentScreen === 'quiz_title') {
            // ディスプレイが問題タイトルから問題表示へ
            displayCurrentScreen = 'quiz_question';
            fetchAndShowQuestion(currentQuizId);
          } 
          else if (displayCurrentScreen === 'quiz_question') {
            // ディスプレイが問題表示から解答表示へ
            displayCurrentScreen = 'quiz_answer';
            
            // すでに回答済みなら答え合わせ画面へ、そうでなければタイマーを停止
            if (playerAnswers[currentQuizId]) {
              showAnswerResult(currentQuizId);
            } else {
              // まだ回答していない場合、タイマーを停止して時間切れとする
              stopTimer();
              answerStatusText.textContent = '時間切れです';
              // 答え合わせ画面に遷移
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
          } 
          else if (displayCurrentScreen === 'quiz_answer') {
            displayCurrentScreen = 'quiz_question';
            
            // すでに回答済みなら回答後待機画面、まだなら回答画面に戻る
            if (playerAnswers[currentQuizId]) {
              showScreen(answeredScreen);
            } else {
              fetchAndShowQuestion(currentQuizId);
            }
          }
          break;
          
        case 'show_answer':
          // 通常の解答表示
          if (currentQuizId) {
            displayCurrentScreen = 'quiz_answer';
            showAnswerResult(currentQuizId);
          }
          break;
          
        case 'show_practice':
          // 問題5の実践待機画面表示
          if (currentQuizId === '5') {
            displayCurrentScreen = 'practice';
            console.log('Player: 問題5の実践待機画面を表示');
            showScreen(practiceScreen);
          }
          break;
          
        case 'show_ranking':
          // ランキング表示
          if (position === 'intro') {
            // ランキング準備画面 - 待機画面を表示
            console.log('Player: ランキング準備画面表示');
            fetchAndShowRanking()
              .then(() => {
                showScreen(rankingWaitingScreen);
              });
          }
          else if (position === 'all') {
            // 全表示の場合は最終結果画面へ
            console.log('Player: ランキング全表示 - 最終結果画面へ遷移');
            fetchAndShowRanking()
              .then(() => {
                showScreen(resultScreen);
              });
          } 
          else if (typeof position === 'string' || typeof position === 'number') {
            // 各順位表示では引き続き待機画面を表示
            console.log(`Player: ランキング${position}表示中 - 待機画面を維持`);
            
            // 待機画面がまだ表示されていない場合のみ取得して表示
            if (currentScreen !== rankingWaitingScreen) {
              fetchAndShowRanking()
                .then(() => {
                  showScreen(rankingWaitingScreen);
                });
            }
          }
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
    
    // テーブルナンバーを取得
    const selectedTable = document.querySelector('input[name="table-number"]:checked');
    tableNumber = selectedTable ? selectedTable.value : null;
    
    try {
      console.log('登録データ:', { name, tableNumber });
      
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
        
        // URLに参加者IDを追加（リロード時に再利用できるように）
        const url = new URL(window.location);
        url.searchParams.set('id', playerId);
        window.history.replaceState({}, '', url);
        
        // プレイヤー名を表示
        displayName.textContent = playerName;
        
        // Socket.io接続を開始
        initSocketConnection();
        
        // わずかな遅延を追加して、登録アクションとの因果関係を明確にする
        setTimeout(() => {
          // 説明画面に切り替え
          showScreen(explanationScreen);
        }, 300); // 300ミリ秒の遅延
        
      } else {
        alert('登録に失敗しました: ' + result.error);
      }
    } catch (error) {
      console.error('プレイヤーの登録に失敗しました:', error);
      alert('登録処理中にエラーが発生しました');
    }
  });
  
  // エンターキーでの登録を無効化
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Enterキーの動作を無効化
      // registerButtonは呼び出さない
    }
  });
  
  // 初期画面を表示
  if (!urlPlayerId) {
    showScreen(registerScreen);
  }
});

// player.jsの末尾に追加
// デバッグ用グローバル関数
window.debugQuiz5 = function() {
  console.log('問題5デバッグ情報:');
  console.log('- 現在のプレイヤーID:', playerId);
  console.log('- 保存されている回答:', playerAnswers['5']);
  
  // 最新の回答データを取得して表示
  fetch(`/api/player/${playerId}/answer/5`)
    .then(res => res.json())
    .then(data => {
      console.log('- サーバーの最新回答データ:', data);
      
      // クライアント側の状態とサーバー側を比較
      if (data.success && data.answer) {
        const serverIsCorrect = data.answer.is_correct === 1;
        const clientIsCorrect = playerAnswers['5']?.isCorrect || false;
        
        console.log('状態比較:');
        console.log(`- クライアント側: isCorrect=${clientIsCorrect}`);
        console.log(`- サーバー側: is_correct=${serverIsCorrect}`);
        
        if (serverIsCorrect !== clientIsCorrect) {
          console.log('⚠️ 不一致検出: クライアントとサーバーの状態が異なります');
        } else {
          console.log('✓ 一致: クライアントとサーバーの状態は同じです');
        }
      }
    })
    .catch(err => {
      console.error('データ取得エラー:', err);
    });
  
  // 正解データを取得して表示
  fetch('/api/admin/quiz/5/answer')
    .then(res => res.json())
    .then(data => {
      console.log('- 問題5の正解データ:', data);
      
      if (data.correct_answer && playerAnswers['5']) {
        const isMatch = data.correct_answer === playerAnswers['5'].answer;
        console.log(`- 回答と正解の一致: ${isMatch ? '一致' : '不一致'}`);
        console.log(`- 自分の回答: "${playerAnswers['5'].answer}"`);
        console.log(`- 現在の正解: "${data.correct_answer}"`);
      }
    })
    .catch(err => {
      console.error('正解データ取得エラー:', err);
    });
};

// 強制的に状態を修正するヘルパー
window.fixQuiz5State = function() {
  fetch('/api/admin/quiz/5/answer')
    .then(res => res.json())
    .then(data => {
      if (data.correct_answer && playerAnswers['5']) {
        const shouldBeCorrect = data.correct_answer === playerAnswers['5'].answer;
        
        console.log(`修正前状態: isCorrect=${playerAnswers['5'].isCorrect}, shouldBe=${shouldBeCorrect}`);
        
        playerAnswers['5'].isCorrect = shouldBeCorrect;
        console.log(`状態を修正しました: isCorrect=${playerAnswers['5'].isCorrect}`);
        
        // 答え合わせ画面を再表示
        if (currentScreen === answerResultScreen) {
          showAnswerResult('5');
        }
      }
    });
};

// 基本的なデバッグ情報をページ読み込み時に表示
setTimeout(() => {
  if (currentQuizId === '5') {
    console.log('[自動デバッグ] 問題5が表示されています');
    window.debugQuiz5();
  }
}, 1000);

// デバッグコマンドのヘルプ
console.log('=== 問題5デバッグツール ===');
console.log('デバッグ情報の表示: window.debugQuiz5()');
console.log('表示状態の修正: window.fixQuiz5State()');