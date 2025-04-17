// public/js/display.js
// メイン画面用のJavaScript
document.addEventListener('DOMContentLoaded', function() {
  // 画面要素
  const welcomeScreen = document.getElementById('welcome-screen');
  const explanationScreen = document.getElementById('explanation-screen');
  const quizTitleScreen = document.getElementById('quiz-title-screen');
  const quizQuestionScreen = document.getElementById('quiz-question-screen');
  const quizAnswerScreen = document.getElementById('quiz-answer-screen');
  const rankingScreen = document.getElementById('ranking-screen');
  const homeButton = document.getElementById('home-button');
  const practiceSreen = document.getElementById('quiz-practice-screen'); // 実践待機画面
  
  // 参加者数表示は削除済みのため、ここで参照しない
  
  // クイズ要素
  const quizTitle = document.getElementById('quiz-title');
  const questionText = document.getElementById('question-text');
  const questionImage = document.getElementById('question-image').querySelector('img');
  const optionsContainer = document.getElementById('options-container');
  const floatingTimer = document.getElementById('floating-timer');
  const floatingTimerValue = document.getElementById('floating-timer-value');
  const answerText = document.getElementById('answer-text');
  const answerImage = document.getElementById('answer-image').querySelector('img');
  const answerExplanation = document.getElementById('answer-explanation');
  const rankingContainer = document.getElementById('ranking-container');
  
  // 現在の状態
  let currentScreen = welcomeScreen;
  let currentQuizId = null;
  let timerInterval = null;
  let timeLeft = 30;
  let displayedRankings = [];
  let refreshInterval = null;
  let isTransitioning = false; // 画面遷移中フラグ
  
  // サーバーとの時刻同期用
  let serverTimeOffset = 0;
  let timerStartTime = 0;
  let timerEndTime = 0;
  
  // 画像のプリロード処理
  function preloadImages() {
    const imagePaths = [
      '/images/qr-code.png',
      '/images/backgrounds/main-bg.jpg',
      '/images/quiz-images/quiz1_question.png',
      '/images/quiz-images/quiz1_answer.png',
      '/images/quiz-images/quiz2_question.png',
      '/images/quiz-images/quiz2_answer.png',
      '/images/quiz-images/quiz3_option1.jpg',
      '/images/quiz-images/quiz3_option2.JPG',
      '/images/quiz-images/quiz3_option3.JPG',
      '/images/quiz-images/quiz3_option4.jpg',
      '/images/quiz-images/quiz3_before.JPG',
      '/images/quiz-images/quiz3_after.JPG',
      '/images/quiz-images/quiz4_option1.png',
      '/images/quiz-images/quiz4_option2.png',
      '/images/quiz-images/quiz4_option3.png',
      '/images/quiz-images/quiz4_option4.png',
      '/images/quiz-images/quiz4_answer.png'
    ];
    
    imagePaths.forEach(path => {
      const img = new Image();
      img.src = path;
    });
  }
  
  // 初期化時に画像をプリロード
  preloadImages();
  
  // 画面を表示する関数
  function showScreen(screen) {
    // 前の画面を非表示
    currentScreen.classList.add('hidden');
    
    // 新しい画面を表示
    screen.classList.remove('hidden');
    currentScreen = screen;
    
    console.log(`Display: 画面を切り替えました: ${screen.id}`);
  }
  
  // タイマーを開始する関数 - シンプルな実装に修正
  function startTimer(seconds = 30) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    floatingTimerValue.textContent = timeLeft;
    
    // フローティングタイマーを表示
    floatingTimer.classList.remove('hidden');
    
    console.log(`Display: シンプルなタイマー開始 ${seconds}秒`);
    
    timerInterval = setInterval(() => {
      timeLeft--;
      floatingTimerValue.textContent = timeLeft;
      
      // 残り時間が10秒以下で警告色に
      if (timeLeft <= 10) {
        floatingTimer.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
      } else {
        floatingTimer.style.backgroundColor = 'rgba(255, 51, 51, 0.9)';
      }
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        
        // 時間切れになったら自動的に解答画面に遷移
        if (currentScreen === quizQuestionScreen && currentQuizId) {
          console.log('Display: 時間切れ - サーバーに通知');
          
          // タイマー終了イベントをサーバーに送信
          socket.emit('timer_expired', { quizId: currentQuizId });
          
          // 解答表示はサーバーからのイベントで処理
        }
      }
    }, 1000);
  }
  
  // 解答が表示されたことをサーバーに通知
  async function markAnswerAsDisplayed(quizId) {
    try {
      await fetch(`/api/admin/quiz/${quizId}/mark-answer-displayed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`Display: クイズ ${quizId} の解答表示をサーバーに通知しました`);
    } catch (error) {
      console.error('Display: 解答表示の通知に失敗しました:', error);
    }
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // フローティングタイマーを非表示
    floatingTimer.classList.add('hidden');
    console.log('Display: タイマーを停止しました');
  }
  
  // ホーム画面に戻る
  function goToHome() {
    // タイマーを停止
    stopTimer();
    
    // 状態をリセット
    currentQuizId = null;
    displayedRankings = [];
    
    // ホーム画面を表示
    showScreen(welcomeScreen);
  }
  
  // クイズの問題を表示する関数
  async function showQuestion(quizId) {
    try {
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('Display: 画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
      // タイマーを必ず停止してリセット
      stopTimer();
      timeLeft = 30;
      floatingTimerValue.textContent = '30';
      
      console.log(`Display: 問題 ${quizId} の表示を開始します`);
      
      const response = await fetch(`/api/quiz/${quizId}`);
      const quizData = await response.json();
      
      // 問題のタイトルを設定
      quizTitle.textContent = `問題 ${quizId}`;
      
      // 問題文と画像を設定
      questionText.textContent = quizData.question;
      
      // 画像選択肢か通常選択肢かで表示方法を変える
      const isImageOptions = quizData.is_image_options === 1;
      
      if (!isImageOptions) {
        // 通常の問題表示
        questionImage.src = quizData.question_image_path || '';
        questionImage.style.display = quizData.question_image_path ? 'block' : 'none';
        
        // 選択肢を設定（テキスト選択肢）
        optionsContainer.innerHTML = '';
        optionsContainer.className = 'options-container';
        
        // 問題5の場合は選択肢に色を付ける
        if (parseInt(quizId) === 5) {
          quizData.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            
            // 新郎・新婦別のクラスを追加
            if (option === '新郎') {
              optionDiv.classList.add('groom');
            } else if (option === '新婦') {
              optionDiv.classList.add('bride');
            }
            
            optionDiv.textContent = option;
            optionsContainer.appendChild(optionDiv);
          });
        } else {
          // 通常のテキスト選択肢
          quizData.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.textContent = option;
            optionsContainer.appendChild(optionDiv);
          });
        }
      } else {
        // 画像選択肢の問題表示
        questionImage.style.display = 'none';
        
        // 選択肢を設定（画像選択肢）
        optionsContainer.innerHTML = '';
        optionsContainer.className = 'image-options-container';
        
        // 問題IDを設定（問題3と4用にサイズ調整するため）
        optionsContainer.setAttribute('data-quiz-id', quizId);
        
        quizData.options.forEach((imagePath, index) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'image-option';
          
          const optionNumber = document.createElement('div');
          optionNumber.className = 'option-number';
          optionNumber.textContent = (index + 1).toString();
          
          const optionImg = document.createElement('img');
          optionImg.src = imagePath;
          optionImg.alt = `選択肢 ${index + 1}`;
          
          optionDiv.appendChild(optionNumber);
          optionDiv.appendChild(optionImg);
          optionsContainer.appendChild(optionDiv);
        });
      }
      
      // 画面を問題画面に切り替え
      showScreen(quizQuestionScreen);
      
      // タイマーはサーバーからのtimer_startイベントで開始
      console.log('Display: 問題表示完了、タイマーはサーバーから開始されます');
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('Display: クイズデータの取得に失敗しました:', error);
      isTransitioning = false;
    }
  }
  
  // クイズの解答を表示する関数
  async function showAnswer(quizId) {
    try {
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('Display: 画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
      // タイマーを停止
      stopTimer();
      
      console.log(`Display: 解答画面 ${quizId} の表示を開始します`);
      
      // 管理者用APIで解答情報を取得
      const response = await fetch(`/api/admin/quiz/${quizId}/answer`);
      const answerData = await response.json();
      
      // 解答テキストを設定
      answerText.textContent = `答えは ${answerData.correct_answer} です`;
      
      // 解説を設定
      answerExplanation.textContent = answerData.explanation || '';
      
      // 既存の答えコンテナを取得
      const answerContainer = document.querySelector('#quiz-answer-screen .content');
      
      // 既存の特殊コンテンツを削除
      const existingBeforeAfter = answerContainer.querySelector('.before-after-container');
      if (existingBeforeAfter) {
        existingBeforeAfter.remove();
      }
      
      const existingBigText = answerContainer.querySelector('.big-text-answer');
      if (existingBigText) {
        existingBigText.remove();
      }
      
      // デフォルトで答え画像エリアを隠す
      const answerImageContainer = document.getElementById('answer-image');
      answerImageContainer.style.display = 'none';
      
      // 特別なケース処理
      if (parseInt(quizId) === 3) {
        // クイズ3の場合: 合成前後の画像比較表示
        // 合成前後の画像比較コンテナを作成
        const beforeAfterContainer = document.createElement('div');
        beforeAfterContainer.className = 'before-after-container';
        
        // 合成前の画像
        const beforeItem = document.createElement('div');
        beforeItem.className = 'before-after-item';
        
        const beforeImg = document.createElement('img');
        beforeImg.src = '/images/quiz-images/quiz3_before.JPG';
        beforeImg.alt = '合成前';
        
        const beforeLabel = document.createElement('div');
        beforeLabel.className = 'label';
        beforeLabel.textContent = '合成前';
        
        beforeItem.appendChild(beforeImg);
        beforeItem.appendChild(beforeLabel);
        
        // 合成後の画像
        const afterItem = document.createElement('div');
        afterItem.className = 'before-after-item';
        
        const afterImg = document.createElement('img');
        afterImg.src = '/images/quiz-images/quiz3_after.JPG';
        afterImg.alt = '合成後';
        
        const afterLabel = document.createElement('div');
        afterLabel.className = 'label';
        afterLabel.textContent = '合成後';
        
        afterItem.appendChild(afterImg);
        afterItem.appendChild(afterLabel);
        
        // コンテナに追加
        beforeAfterContainer.appendChild(beforeItem);
        beforeAfterContainer.appendChild(afterItem);
        
        // 解説の前に挿入
        answerContainer.insertBefore(beforeAfterContainer, answerExplanation);
        
      } else if (parseInt(quizId) === 5) {
        // クイズ5の場合: 大きなテキスト表示（新郎・新婦色分け）
        const bigTextAnswer = document.createElement('div');
        bigTextAnswer.className = 'big-text-answer';
        
        // 新郎・新婦別のクラスを追加
        if (answerData.correct_answer === '新郎') {
          bigTextAnswer.classList.add('groom');
        } else if (answerData.correct_answer === '新婦') {
          bigTextAnswer.classList.add('bride');
        }
        
        bigTextAnswer.textContent = answerData.correct_answer;
        
        // 解説の前に挿入
        answerContainer.insertBefore(bigTextAnswer, answerExplanation);
      } else {
        // 通常のクイズの場合: 標準の答え画像表示
        answerImage.src = answerData.answer_image_path || '';
        answerImageContainer.style.display = answerData.answer_image_path ? 'block' : 'none';
      }
      
      // 画面を解答画面に切り替え
      showScreen(quizAnswerScreen);
      
      // 解答表示を通知
      markAnswerAsDisplayed(quizId);
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('Display: 解答データの取得に失敗しました:', error);
      isTransitioning = false;
    }
  }
  
  // ランキングアイテムを作成する関数
  function createRankingItem(ranking, position) {
    const rankingItem = document.createElement('div');
    rankingItem.className = 'ranking-item';
    rankingItem.dataset.position = position;
    
    const positionDiv = document.createElement('div');
    positionDiv.className = 'ranking-position';
    positionDiv.textContent = `${position}位`;
    
    // テーブルナンバーを表示するdiv要素を作成
    const tableDiv = document.createElement('div');
    tableDiv.className = 'ranking-table';
    
    // テーブルナンバーがあれば表示、なければ「-」表示
    // テーブルごとに色を変える
    if (ranking.table_number) {
      tableDiv.textContent = ranking.table_number;
      
      // テーブルごとに色を変える
      const tableColors = {
        'A': '#007bff', // 青
        'B': '#28a745', // 緑
        'C': '#dc3545', // 赤
        'D': '#6f42c1', // 紫
        'E': '#fd7e14', // オレンジ
        'F': '#20c997', // ティール
        'G': '#e83e8c', // ピンク
        'H': '#6c757d'  // グレー
      };
      
      if (tableColors[ranking.table_number]) {
        tableDiv.style.backgroundColor = tableColors[ranking.table_number];
      }
    } else {
      tableDiv.textContent = '-';
      tableDiv.style.backgroundColor = '#6c757d'; // 未設定は灰色
    }
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'ranking-name';
    nameDiv.textContent = ranking.player_name;
    
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'ranking-score';
    
    const correctSpan = document.createElement('span');
    correctSpan.className = 'correct-count';
    correctSpan.textContent = `${ranking.correct_count}問正解`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'response-time';
    // ミリ秒から秒に変換して表示（小数点2桁）
    const seconds = (ranking.total_time / 1000).toFixed(2);
    timeSpan.textContent = `${seconds}秒`;
    
    scoreDiv.appendChild(correctSpan);
    scoreDiv.appendChild(timeSpan);
    
    rankingItem.appendChild(positionDiv);
    rankingItem.appendChild(tableDiv);  // テーブルナンバーを追加
    rankingItem.appendChild(nameDiv);
    rankingItem.appendChild(scoreDiv);
    
    return rankingItem;
  }
  
  // ランキングを表示する関数
  async function showRanking(position = 'all') {
    try {
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('Display: 画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
      console.log(`Display: ランキング表示開始 - 位置: ${position}`);
      
      // まだランキングデータを取得していない場合は取得
      if (displayedRankings.length === 0) {
        const response = await fetch('/api/quiz/ranking/all');
        displayedRankings = await response.json();
        
        console.log(`Display: ランキングデータ取得 - ${displayedRankings.length}件`);
        
        // ランキングコンテナをクリア
        rankingContainer.innerHTML = '';
      }
      
      // 特定の順位だけを表示する場合
      if (position !== 'all' && position >= 1 && position <= 5) {
        const position_num = parseInt(position);
        const index = position_num - 1; // 1位→0, 2位→1, ...
        
        if (displayedRankings.length > index) {
          const ranking = displayedRankings[index];
          
          // ランキングアイテムを作成
          const rankingItem = createRankingItem(ranking, position_num);
          
          // 既に表示されていなければ追加（常に上部に追加）
          const existingItem = document.querySelector(`[data-position="${position_num}"]`);
          if (!existingItem) {
            // 先頭に追加（一番上に最新のランキングを表示）
            rankingContainer.insertBefore(rankingItem, rankingContainer.firstChild);
            console.log(`Display: ${position_num}位を表示しました - ${ranking.player_name}`);
          }
        }
      } else if (position === 'all') {
        // 全表示の場合は上位5件を表示
        rankingContainer.innerHTML = ''; // コンテナをクリア
        
        const topRankings = displayedRankings.slice(0, 5);
        // 1位から5位まで順に表示（降順）
        for (let i = 0; i < topRankings.length; i++) {
          const position = i + 1;
          const ranking = topRankings[i];
          const rankingItem = createRankingItem(ranking, position);
          rankingContainer.appendChild(rankingItem);
        }
        
        console.log(`Display: 全ランキング表示（上位5件）`);
      }
      
      // 画面をランキング画面に切り替え
      showScreen(rankingScreen);
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('Display: ランキングデータの取得に失敗しました:', error);
      isTransitioning = false;
    }
  }
  
  // Socket.io接続
  const socket = io();
  
  // 接続時の処理
  socket.on('connect', () => {
    console.log('Display: Socket.io に接続しました');
    socket.emit('register', { type: 'display' });
  });
  
  // タイマー準備イベントハンドラ
  socket.on('timer_prepare', (data) => {
    const { quizId } = data;
    
    console.log(`Display: タイマー準備イベント受信 - クイズID ${quizId}`);
    
    // 条件チェック
    if (currentQuizId === quizId && currentScreen === quizQuestionScreen) {
      console.log('Display: タイマー準備OK - 現在問題画面を表示中');
      
      // タイマー表示を初期化
      timeLeft = 30;
      floatingTimerValue.textContent = '30';
      
      // フローティングタイマーを表示するが、カウントダウンはまだ開始しない
      floatingTimer.classList.remove('hidden');
    } else {
      console.log(`Display: タイマー準備条件不一致 - 現在のクイズID: ${currentQuizId}, 画面: ${currentScreen.id}`);
    }
  });
  
  // タイマー開始イベントハンドラ
  socket.on('timer_start', (data) => {
    const { quizId, duration, startTime, timestamp } = data;
    
    console.log(`Display: タイマー開始イベント受信 - クイズID ${quizId}, 時間 ${duration}秒`);
    
    // 現在のクイズIDと画面をチェック
    if (currentQuizId === quizId && currentScreen === quizQuestionScreen) {
      console.log('Display: タイマー開始条件OK - タイマー開始');
      
      // サーバー時刻の差分を計算
      serverTimeOffset = timestamp - Date.now();
      
      // サーバーから送られた情報を保存
      timerStartTime = startTime;
      timerEndTime = startTime + (duration * 1000);
      
      // タイマーを開始
      startTimer(duration);
    } else {
      console.log(`Display: タイマー開始条件不一致 - 現在のクイズID: ${currentQuizId}, 画面: ${currentScreen.id}`);
    }
  });
  
  // タイマー同期イベント
  socket.on('timer_sync', (data) => {
    const { quizId, remainingTime, timestamp } = data;
    
    // デバッグログを控えめに（頻繁に発生するイベント）
    if (remainingTime % 5 === 0) {
      console.log(`Display: タイマー同期 - クイズ ${quizId}, 残り ${remainingTime}秒`);
    }
    
    // 現在のクイズIDが一致し、問題表示中の場合のみタイマーを同期
    if (currentQuizId === quizId && currentScreen === quizQuestionScreen) {
      // サーバー時刻の差分を更新
      serverTimeOffset = timestamp - Date.now();
      
      // タイマー値を同期
      if (timeLeft !== remainingTime) {
        console.log(`Display: タイマー値を同期: ${timeLeft} → ${remainingTime}秒`);
        timeLeft = remainingTime;
        floatingTimerValue.textContent = timeLeft;
        
        // 残り時間に応じた表示変更
        if (timeLeft <= 10) {
          floatingTimer.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
        } else {
          floatingTimer.style.backgroundColor = 'rgba(255, 51, 51, 0.9)';
        }
      }
    }
  });
  
  // 強制遷移イベントのハンドラを追加
  socket.on('force_transition', (data) => {
    const { quizId, target, timestamp } = data;
    console.log(`Display: 強制遷移指示受信 - 遷移先: ${target}, クイズID: ${quizId}`);
    
    if (quizId !== currentQuizId) {
      console.log('Display: 現在のクイズIDと一致しないため無視します');
      return;
    }
    
    // 遷移先に応じた処理
    if (target === 'answer') {
      // タイマーを停止
      stopTimer();
      
      // 解答画面に強制遷移
      console.log('Display: サーバーからの指示により解答画面に強制遷移します');
      showAnswer(quizId);
    } else if (target === 'practice') {
      // タイマーを停止
      stopTimer();
      
      // 実践待機画面に強制遷移
      console.log('Display: サーバーからの指示により実践待機画面に強制遷移します');
      showScreen(practiceSreen);
    }
  });
  
  // クイズイベントの処理
  socket.on('quiz_event', (data) => {
    const { event, quizId, position, auto, manual, resetTimer } = data;
    
    console.log(`Display: クイズイベント受信 - ${event}, クイズID: ${quizId || 'なし'}`);
    
    // タイマーリセットフラグが指定されていれば実行
    if (resetTimer) {
      stopTimer();
      timeLeft = 30;
      floatingTimerValue.textContent = '30';
      console.log('Display: タイマーリセット完了');
    }
    
    switch (event) {
      case 'quiz_started':
        showScreen(explanationScreen);
        break;
        
      case 'show_question':
        if (quizId) {
          currentQuizId = quizId;
          showScreen(quizTitleScreen);
          quizTitle.textContent = `問題 ${quizId}`;
        }
        break;
        
      case 'next_slide':
        if (currentScreen === quizTitleScreen && currentQuizId) {
          console.log('Display: タイトル画面から問題画面へ遷移');
          showQuestion(currentQuizId);
          // タイマーはサーバーからのtimer_startイベントで開始
        } else if (currentScreen === quizQuestionScreen && currentQuizId) {
          console.log('Display: 問題画面から解答画面へ遷移');
          showAnswer(currentQuizId);
        }
        break;
        
      case 'prev_slide':
        if (currentScreen === quizQuestionScreen) {
          stopTimer();
          showScreen(quizTitleScreen);
        } else if (currentScreen === quizAnswerScreen) {
          showQuestion(currentQuizId);
        }
        break;
        
      case 'show_answer':
        if (currentQuizId) {
          showAnswer(currentQuizId);
        }
        break;
        
      case 'show_practice':
        // 実践待機画面表示（問題5用）
        if (currentQuizId === '5') {
          console.log('Display: 問題5の実践待機画面に遷移');
          showScreen(practiceSreen);
        }
        break;
        
      case 'show_ranking':
        showRanking(position);
        break;
        
      case 'reset_all':
        goToHome();
        break;
    }
  });
  
  // ホームボタンのクリックイベント
  homeButton.addEventListener('click', goToHome);
});