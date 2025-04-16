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
  let refreshInterval = null;
  let isTransitioning = false; // 画面遷移中フラグ
  
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
    
    // QRコード画面の場合は、10秒ごとの更新を開始
    if (screen === welcomeScreen) {
      startParticipantCountRefresh();
    } else {
      // QRコード画面以外では更新を停止
      stopParticipantCountRefresh();
    }
    
    console.log(`画面を切り替えました: ${screen.id}`);
  }
  
  // 参加者数更新の定期実行
  function startParticipantCountRefresh() {
    refreshInterval = setInterval(() => {
      fetchParticipantCount();
    }, 10000); // 10秒ごとに更新
  }
  
  // 参加者数の取得
  async function fetchParticipantCount() {
    try {
      const response = await fetch('/api/quiz/stats/participants');
      const data = await response.json();
      participantCount.textContent = `${data.count}/39`;
      
      // 参加者が最大（39人）に達した場合は視覚的フィードバック
      if (data.count >= 39) {
        participantCount.parentElement.classList.add('full-participants');
      } else {
        participantCount.parentElement.classList.remove('full-participants');
      }
    } catch (error) {
      console.error('参加者数の取得中にエラーが発生しました:', error);
    }
  }
  
  // 参加者数更新の停止
  function stopParticipantCountRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
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
    
    // タイマー開始時刻を記録
    const timerStartTime = Date.now();
    
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
        
        // 時間切れになったら自動的に解答画面に遷移
        if (currentScreen === quizQuestionScreen && currentQuizId) {
          console.log('時間切れ: 自動的に解答画面に遷移します');
          
          // タイマー終了イベントをサーバーに送信
          socket.emit('timer_expired', { quizId: currentQuizId });
          
          // 解答画面に遷移
          showAnswer(currentQuizId);
          
          // 解答が表示されたことをサーバーに通知
          markAnswerAsDisplayed(currentQuizId);
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
      console.log(`クイズ ${quizId} の解答表示をサーバーに通知しました`);
    } catch (error) {
      console.error('解答表示の通知に失敗しました:', error);
    }
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
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
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
      
      // タイマーを開始
      startTimer();
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('クイズデータの取得に失敗しました:', error);
      isTransitioning = false;
    }
  }
  
  // クイズの解答を表示する関数
  async function showAnswer(quizId) {
    try {
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
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
      
      // 回答状況セクションを非表示に設定
      const answerStats = document.querySelector('.answer-stats');
      if (answerStats) {
        answerStats.style.display = 'none';
      }
      
      // 画面を解答画面に切り替え
      showScreen(quizAnswerScreen);
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('解答データの取得に失敗しました:', error);
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
    tableDiv.textContent = ranking.table_number || '-';
    
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
    rankingItem.appendChild(tableDiv); // テーブルナンバーを追加
    rankingItem.appendChild(nameDiv);
    rankingItem.appendChild(scoreDiv);
    
    return rankingItem;
  }
  
  // ランキングを表示する関数
  async function showRanking(position = 'all') {
    try {
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
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
      
      // 遷移完了
      isTransitioning = false;
      
    } catch (error) {
      console.error('ランキングデータの取得に失敗しました:', error);
      isTransitioning = false;
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
    // プレイヤー数の表示を更新（最大値は39に制限）
    const playerCount = stats.displayCount;
    participantCount.textContent = `${Math.min(playerCount, 39)}/39`;
    
    // もし接続数が39人に達したら視覚的なフィードバックを追加
    if (playerCount >= 39) {
      participantCount.parentElement.classList.add('full-participants');
    } else {
      participantCount.parentElement.classList.remove('full-participants');
    }
  });

  // 初期表示時に参加者数の更新を開始
  if (currentScreen === welcomeScreen) {
    // Socket.ioで常に最新状態を取得するため、APIポーリングは不要
    // broadcastConnectionStats()が接続時に呼ばれるため、特別な初期化は不要
  }
  
  // 強制遷移イベントのハンドラを追加
  socket.on('force_transition', (data) => {
    const { quizId, target, timestamp } = data;
    console.log(`強制遷移指示受信: ${target} - クイズID: ${quizId}`);
    
    if (quizId !== currentQuizId) {
      console.log('現在のクイズIDと一致しないため無視します');
      return;
    }
    
    // 遷移先に応じた処理
    if (target === 'answer') {
      // タイマーを停止
      stopTimer();
      
      // 解答画面に強制遷移
      console.log('サーバーからの指示により解答画面に強制遷移します');
      showAnswer(quizId);
      
      // 解答表示フラグを設定
      markAnswerAsDisplayed(quizId);
    }
  });
  
  // タイマー同期イベント
  socket.on('timer_sync', (data) => {
    const { quizId, remainingTime } = data;
    
    // 現在のクイズIDが一致し、問題表示中の場合のみタイマーを同期
    if (currentQuizId === quizId && currentScreen === quizQuestionScreen) {
      // タイマーをリセットして残り時間から開始
      clearInterval(timerInterval);
      timeLeft = remainingTime;
      floatingTimerValue.textContent = timeLeft;
      
      // タイマーが0以下なら停止、そうでなければ新たなタイマーを開始
      if (timeLeft <= 0) {
        // タイマーが0の場合は停止して時間切れ処理
        stopTimer();
      } else {
        // フローティングタイマーを表示
        floatingTimer.classList.remove('hidden');
        
        // 新たなタイマーを開始
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
            // タイマー終了時の処理はサーバーからの指示を待つ
          }
        }, 1000);
      }
    }
  });
  
  // クイズイベントの処理
  socket.on('quiz_event', (data) => {
    const { event, quizId, position, auto, manual } = data;
    
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
  
  // 初期表示時に参加者数の更新を開始
  if (currentScreen === welcomeScreen) {
    startParticipantCountRefresh();
  }
});