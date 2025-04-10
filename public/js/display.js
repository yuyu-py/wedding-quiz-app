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
  const timerValue = document.getElementById('timer-value');
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
    timerValue.textContent = timeLeft;
    
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
      
      // 画面を解答画面に切り替え
      showScreen(quizAnswerScreen);
      
    } catch (error) {
      console.error('解答データの取得に失敗しました:', error);
    }
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
    // ミリ秒から秒に変換して小数点2桁まで表示
    const seconds = (ranking.total_time / 1000).toFixed(2);
    timeSpan.textContent = `${seconds}秒`;
    
    scoreDiv.appendChild(correctSpan);
    scoreDiv.appendChild(timeSpan);
    
    rankingItem.appendChild(positionDiv);
    rankingItem.appendChild(nameDiv);
    rankingItem.appendChild(scoreDiv);
    
    return rankingItem;
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
  
  // クイズイベントの処理
  socket.on('quiz_event', async (data) => {
    const { event, quizId, position } = data;
    
    switch (event) {
      case 'quiz_started':
        // クイズ開始時の処理
        showScreen(explanationScreen);
        break;
        
      case 'show_question':
        // 問題表示の処理
        if (quizId) {
          currentQuizId = quizId;
          // まず問題タイトル画面を表示
          quizTitle.textContent = `問題 ${quizId}`;
          showScreen(quizTitleScreen);
        }
        break;
        
      case 'next_slide':
        // 次のスライドに進む処理
        if (currentScreen === quizTitleScreen && currentQuizId) {
          await showQuestion(currentQuizId);
        } else if (currentScreen === quizQuestionScreen && currentQuizId) {
          await showAnswer(currentQuizId);
        }
        break;
        
      case 'prev_slide':
        // 前のスライドに戻る処理
        if (currentScreen === quizQuestionScreen) {
          stopTimer();
          quizTitle.textContent = `問題 ${currentQuizId}`;
          showScreen(quizTitleScreen);
        } else if (currentScreen === quizAnswerScreen) {
          await showQuestion(currentQuizId);
        }
        break;
        
      case 'show_answer':
        // 解答表示の処理
        if (currentQuizId) {
          await showAnswer(currentQuizId);
        }
        break;
        
      case 'show_ranking':
        // ランキング表示の処理
        await showRanking(position);
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
  
  // ホームボタンのクリックイベント
  homeButton.addEventListener('click', () => {
    goToHome();
  });
  
  // 初期画面を表示
  showScreen(welcomeScreen);
});
