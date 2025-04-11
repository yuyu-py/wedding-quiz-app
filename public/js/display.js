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
  
  // タイマー表示エレメント
  const timerDisplay = document.getElementById('timer-display');
  
  // 参加者カウント表示
  const participantCount = document.getElementById('participant-count');
  
  // クイズ要素
  const quizTitle = document.getElementById('quiz-title');
  const questionText = document.getElementById('question-text');
  const questionImage = document.getElementById('question-image').querySelector('img');
  const optionsContainer = document.getElementById('options-container');
  const timerValue = document.getElementById('timer-value');
  const answerText = document.getElementById('answer-text');
  const answerImage = document.getElementById('answer-image').querySelector('img');
  const answerExplanation = document.getElementById('answer-explanation');
  const answerStatsContainer = document.getElementById('answer-stats-container');
  const rankingContainer = document.getElementById('ranking-container');
  
  // QRコード画像
  const qrCodeImage = document.getElementById('qr-code-image');
  
  // 現在の状態
  let currentScreen = welcomeScreen;
  let currentQuizId = null;
  let timerInterval = null;
  let timeLeft = 30;
  let displayedRankings = [];
  
  // 画面を表示する関数
  function showScreen(screen) {
    currentScreen.classList.add('hidden');
    screen.classList.remove('hidden');
    currentScreen = screen;
  }
  
  // ホーム画面に戻る
  function goToHome() {
    // タイマーを停止
    stopTimer();
    
    // 状態をリセット
    currentQuizId = null;
    displayedRankings = [];
    
    // タイマー表示を非表示
    timerDisplay.classList.add('hidden');
    
    // ホーム画面を表示
    showScreen(welcomeScreen);
  }
  
  // タイマーを開始する関数
  function startTimer(seconds = 30) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    timerValue.textContent = timeLeft;
    
    // タイマー表示を表示
    timerDisplay.classList.remove('hidden');
    
    timerInterval = setInterval(() => {
      timeLeft--;
      timerValue.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        // 時間切れ時の処理があればここに追加
      }
    }, 1000);
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    clearInterval(timerInterval);
    timerDisplay.classList.add('hidden');
  }
  
  // クイズの問題を表示する関数
  async function showQuestion(quizId) {
    try {
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
        
        quizData.options.forEach(option => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'option';
          optionDiv.textContent = option;
          optionsContainer.appendChild(optionDiv);
        });
      } else {
        // 画像選択肢の問題表示
        questionImage.style.display = 'none';
        
        // 選択肢を設定（画像選択肢）
        optionsContainer.innerHTML = '';
        optionsContainer.className = 'image-options-container';
        
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
      
      // タイマーを開始
      startTimer();
      
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
    }
  }
  
  // クイズの解答を表示する関数
  async function showAnswer(quizId) {
    try {
      // タイマーを停止
      stopTimer();
      
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
        // クイズ5の場合: 大きなテキスト表示
        // 大きなテキスト答えを作成
        const bigTextAnswer = document.createElement('div');
        bigTextAnswer.className = 'big-text-answer';
        bigTextAnswer.textContent = answerData.correct_answer; // 新郎 or 新婦
        
        // 解説の前に挿入
        answerContainer.insertBefore(bigTextAnswer, answerExplanation);
      } else {
        // 通常のクイズの場合: 標準の答え画像表示
        answerImage.src = answerData.answer_image_path || '';
        answerImageContainer.style.display = answerData.answer_image_path ? 'block' : 'none';
      }
      
      // 回答状況を取得
      const statsResponse = await fetch(`/api/quiz/${quizId}/stats`);
      const statsData = await statsResponse.json();
      
      // 回答統計を表示
      answerStatsContainer.innerHTML = '';
      
      // 画像選択肢かどうかを判定
      const isImageOptions = answerData.is_image_options === 1;
      
      statsData.stats.forEach((stat, index) => {
        const statDiv = document.createElement('div');
        statDiv.className = 'stat-item';
        if (stat.isCorrect) {
          statDiv.classList.add('correct');
        }
        
        const optionSpan = document.createElement('span');
        optionSpan.className = 'stat-option';
        
        if (isImageOptions) {
          // 画像選択肢の場合は画像を表示
          const optionImage = document.createElement('img');
          optionImage.src = stat.option; // 選択肢の画像パス
          optionImage.alt = `選択肢 ${index + 1}`;
          
          const optionText = document.createElement('span');
          optionText.textContent = `選択肢 ${index + 1}`;
          
          optionSpan.appendChild(optionImage);
          optionSpan.appendChild(optionText);
        } else {
          // 通常選択肢の場合はテキストを表示
          optionSpan.textContent = stat.option;
        }
        
        const countSpan = document.createElement('span');
        countSpan.className = 'stat-count';
        countSpan.textContent = `${stat.count}人`;
        
        statDiv.appendChild(optionSpan);
        statDiv.appendChild(countSpan);
        answerStatsContainer.appendChild(statDiv);
      });
      
      // 画面を解答画面に切り替え
      showScreen(quizAnswerScreen);
      
    } catch (error) {
      console.error('解答データの取得に失敗しました:', error);
    }
  }
  
  // ランキングを表示する関数
  async function showRanking(position = 'all') {
    try {
      // タイマーを停止
      stopTimer();
      
      // まだランキングデータを取得していない場合は取得
      if (displayedRankings.length === 0) {
        const response = await fetch('/api/quiz/ranking/all');
        displayedRankings = await response.json();
        
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
      }
      
      // 画面をランキング画面に切り替え
      showScreen(rankingScreen);
      
    } catch (error) {
      console.error('ランキングデータの取得に失敗しました:', error);
    }
  }
  
  // ランキングアイテムを作成する関数
  function createRankingItem(ranking, position) {
    const rankingItem = document.createElement('div');
    rankingItem.className = 'ranking-item';
    rankingItem.dataset.position = position;
    
    const rankingPosition = document.createElement('div');
    rankingPosition.className = 'ranking-position';
    rankingPosition.textContent = `${position}位`;
    
    const rankingName = document.createElement('div');
    rankingName.className = 'ranking-name';
    rankingName.textContent = ranking.player_name;
    
    const rankingScore = document.createElement('div');
    rankingScore.className = 'ranking-score';
    
    const correctCount = document.createElement('span');
    correctCount.className = 'correct-count';
    correctCount.textContent = `${ranking.correct_count}問正解`;
    
    const responseTime = document.createElement('span');
    responseTime.className = 'response-time';
    // ミリ秒から秒に変換して小数点2桁まで表示
    const seconds = (ranking.total_time / 1000).toFixed(2);
    responseTime.textContent = `${seconds}秒`;
    
    rankingScore.appendChild(correctCount);
    rankingScore.appendChild(responseTime);
    
    rankingItem.appendChild(rankingPosition);
    rankingItem.appendChild(rankingName);
    rankingItem.appendChild(rankingScore);
    
    return rankingItem;
  }
  
  // QRコードを更新する関数
  function updateQRCode() {
    // タイムスタンプをパラメータに追加して、キャッシュを防ぐ
    const timestamp = new Date().getTime();
    qrCodeImage.src = `/images/qr-code.png?t=${timestamp}`;
  }
  
  // 画像を事前に読み込む関数
  function preloadImages() {
    // クイズ画像のリスト
    const imagesToPreload = [
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
    
    // 各画像を事前に読み込む
    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
      img.className = 'preload-image';
      document.body.appendChild(img);
    });
  }
  
  // Socket.io接続
  const socket = io();
  
  // 接続時の処理
  socket.on('connect', () => {
    console.log('Socket.io に接続しました');
    // ディスプレイとして登録
    socket.emit('register', { type: 'display' });
  });
  
  // 登録完了時の処理
  socket.on('registered', (data) => {
    console.log('登録が完了しました:', data);
  });
  
  // 接続数の更新
  socket.on('connection_stats', (stats) => {
    participantCount.textContent = stats.players;
  });
  
  // クイズイベントを受信
  socket.on('quiz_event', (data) => {
    const { event, quizId, position } = data;
    
    // リセットイベント時にQRコードを更新
    if (event === 'reset_all') {
      updateQRCode();
      goToHome();
      return;
    }
    
    switch (event) {
      case 'quiz_started':
        currentScreen = explanationScreen;
        showScreen(explanationScreen);
        break;
        
      case 'show_question':
        if (quizId) {
          currentQuizId = quizId;
          showScreen(quizTitleScreen);
        }
        break;
        
      case 'next_slide':
        if (currentScreen === quizTitleScreen) {
          showQuestion(currentQuizId);
        } else if (currentScreen === quizQuestionScreen) {
          showAnswer(currentQuizId);
        }
        break;
        
      case 'prev_slide':
        if (currentScreen === quizQuestionScreen) {
          showScreen(quizTitleScreen);
          stopTimer();
        } else if (currentScreen === quizAnswerScreen) {
          showQuestion(currentQuizId);
        }
        break;
        
      case 'show_answer':
        showAnswer(currentQuizId);
        break;
        
      case 'show_ranking':
        showRanking(position);
        break;
    }
  });
  
  // ホームボタンのクリックイベント
  homeButton.addEventListener('click', () => {
    goToHome();
  });
  
  // 初期化時に画像を事前読み込み
  preloadImages();
  
  // 初回のQRコード更新
  updateQRCode();
});