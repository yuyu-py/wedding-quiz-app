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
  
  // 参加者カウント表示
  const participantCount = document.getElementById('participant-count');
  
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
  const answerStatsContainer = document.getElementById('answer-stats-container');
  const rankingContainer = document.getElementById('ranking-container');
  
  // 現在の状態
  let currentScreen = welcomeScreen;
  let currentQuizId = null;
  let timerInterval = null;
  let timeLeft = 30;
  let displayedRankings = [];
  
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
    
    // ホーム画面を表示
    showScreen(welcomeScreen);
  }
  
  // タイマーを開始する関数
  function startTimer(seconds = 30) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    floatingTimerValue.textContent = timeLeft;
    
    // フローティングタイマーを表示
    floatingTimer.classList.remove('hidden');
    
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
        // 時間切れ時の処理があればここに追加
      }
    }, 1000);
  }
  
  // タイマーを停止する関数
  function stopTimer() {
    clearInterval(timerInterval);
    // フローティングタイマーを非表示
    floatingTimer.classList.add('hidden');
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
      
      // 回答状況を取得
      const statsResponse = await fetch(`/api/quiz/${quizId}/stats`);
      const statsData = await statsResponse.json();
      
      // 問題4と5の場合は画像選択肢の回答状況表示を変更
      if (parseInt(quizId) === 4 || parseInt(quizId) === 5) {
        if (parseInt(quizId) === 5) {
          // 問題5の場合は特別なテキスト表示
          answerStatsContainer.className = 'stats-container';
          answerStatsContainer.innerHTML = '';
          
          statsData.stats.forEach((stat, index) => {
            const statDiv = document.createElement('div');
            statDiv.className = 'stat-item';
            
            // 新郎・新婦別のクラスを追加
            if (stat.option === '新郎') {
              statDiv.classList.add('groom');
            } else if (stat.option === '新婦') {
              statDiv.classList.add('bride');
            }
            
            if (stat.isCorrect) {
              statDiv.classList.add('correct');
            }
            
            const optionSpan = document.createElement('span');
            optionSpan.className = 'stat-option';
            optionSpan.textContent = stat.option;
            
            const countSpan = document.createElement('span');
            countSpan.className = 'stat-count';
            countSpan.textContent = `${stat.count}人`;
            
            statDiv.appendChild(optionSpan);
            statDiv.appendChild(countSpan);
            answerStatsContainer.appendChild(statDiv);
          });
        } else {
          // 問題4の場合は画像表示
          answerStatsContainer.className = 'image-stats-container';
          answerStatsContainer.innerHTML = '';
          
          // 画像パスの設定
          const optionImages = [
            '/images/quiz-images/quiz4_option1.png',
            '/images/quiz-images/quiz4_option2.png',
            '/images/quiz-images/quiz4_option3.png',
            '/images/quiz-images/quiz4_option4.png'
          ];
          
          statsData.stats.forEach((stat, index) => {
            const statDiv = document.createElement('div');
            statDiv.className = 'image-stat-item';
            if (stat.isCorrect) {
              statDiv.classList.add('correct');
            }
            
            const img = document.createElement('img');
            img.src = optionImages[index] || '';
            img.alt = `選択肢 ${index + 1}`;
            
            const overlay = document.createElement('div');
            overlay.className = 'image-stat-overlay';
            
            const optionNumber = document.createElement('span');
            optionNumber.className = 'image-stat-number';
            optionNumber.textContent = `選択肢 ${index + 1}`;
            
            const countSpan = document.createElement('span');
            countSpan.className = 'image-stat-count';
            countSpan.textContent = `${stat.count}人`;
            
            overlay.appendChild(optionNumber);
            overlay.appendChild(countSpan);
            
            statDiv.appendChild(img);
            statDiv.appendChild(overlay);
            answerStatsContainer.appendChild(statDiv);
          });
        }
      } else {
        // 通常の選択肢の場合
        answerStatsContainer.className = 'stats-container';
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
            // 画像選択肢の場合は番号を表示
            optionSpan.textContent = `選択肢 ${index + 1}`;
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
      }
      
      // 画面を解答画面に切り替え
      showScreen(quizAnswerScreen);
      
    } catch (error) {
      console.error('解答データの取得に失敗しました:', error);
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
    rankingItem.appendChild(nameDiv);
    rankingItem.appendChild(scoreDiv);
    
    return rankingItem;
  }
  
  // ランキングを表示する関数
  async function showRanking(position = 'all') {
    try {
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
  
  // Socket.io接続
  const socket = io();
  
  // 接続時の処理
  socket.on('connect', () => {
    console.log('Socket.io に接続しました');
    socket.emit('register', { type: 'display' });
  });
  
  // 接続数の更新
  socket.on('connection_stats', (stats) => {
    participantCount.textContent = stats.players;
  });
  
  // クイズイベントの処理
  socket.on('quiz_event', (data) => {
    const { event, quizId, position } = data;
    
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
          showQuestion(currentQuizId);
        } else if (currentScreen === quizQuestionScreen && currentQuizId) {
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