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
  const rankingIntroScreen = document.getElementById('ranking-intro-screen');
  const practiceScreen = document.getElementById('quiz-practice-screen');
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
  const rankingContainer = document.getElementById('ranking-container');
  
  // 現在の状態
  let currentScreen = welcomeScreen;
  let currentQuizId = null;
  let timerInterval = null;
  let timeLeft = 30;
  let displayedRankings = [];
  let refreshInterval = null;
  let isTransitioning = false; // 画面遷移中フラグ
  
  // タイマー同期のための変数
  let serverTimeOffset = 0;      // サーバーとの時間差
  let timerEndTime = 0;          // 終了時刻（ローカル時間）
  let lastDisplayedTime = 30;    // 最後に表示した時間（巻き戻り防止用）
  let nextScheduledSecond = 30;  // 次に表示する予定の秒数
  
  // タイマー表示管理用の変数
  let timerVisible = false;      // タイマー表示状態を追跡
  let pendingTimerStart = false; // タイマー開始待機状態
  
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
  
  // タイマー表示を確実にする関数
  function ensureTimerVisible() {
    // タイマーの表示状態を確認
    const isCurrentlyVisible = !floatingTimer.classList.contains('hidden');
    
    if (!isCurrentlyVisible) {
      floatingTimer.classList.remove('hidden');
      console.log('タイマーを表示状態に設定');
      timerVisible = true;
    }
  }
  
  // タイマーを確実に非表示にする関数
  function hideTimer() {
    floatingTimer.classList.add('hidden');
    console.log('タイマーを非表示に設定');
    timerVisible = false;
  }
  
  // 画面を表示する関数
  function showScreen(screen) {
    // 前の画面を非表示
    currentScreen.classList.add('hidden');
    
    // 新しい画面を表示
    screen.classList.remove('hidden');
    currentScreen = screen;
    
    console.log(`画面を切り替えました: ${screen.id}`);
    
    // 問題画面への遷移時、タイマー待機中なら表示
    if (screen.id === 'quiz-question-screen' && pendingTimerStart) {
      pendingTimerStart = false;
      ensureTimerVisible();
      console.log('画面遷移時に待機中だったタイマーを表示');
    }
    
    // 非問題画面への遷移時はタイマーを必ず非表示
    if (screen.id !== 'quiz-question-screen') {
      hideTimer();
    }
    
    // QRコード画面の場合は、10秒ごとの更新を開始
    if (screen === welcomeScreen) {
      startParticipantCountRefresh();
    } else {
      // QRコード画面以外では更新を停止
      stopParticipantCountRefresh();
    }
  }
  
  // 参加者数更新の開始
  function startParticipantCountRefresh() {
    stopParticipantCountRefresh(); // 既存の更新を停止
    
    // APIから参加者数を取得
    const fetchParticipantCount = async () => {
      try {
        const response = await fetch('/api/quiz/stats/participants');
        const data = await response.json();
        
        // 参加者数を更新（最大値は39に制限）
        const count = Math.min(data.count, 39);
        participantCount.textContent = `${count}/39`;
      } catch (error) {
        console.error('参加者数の取得に失敗しました:', error);
      }
    };
    
    // 初回取得
    fetchParticipantCount();
    
    // 10秒ごとに更新
    refreshInterval = setInterval(fetchParticipantCount, 10000);
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
  
  // タイマー内部停止関数（表示状態は変更しない）
  function stopTimerInternal() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  
  // タイマー停止関数（表示も非表示に）
  function stopTimer() {
    stopTimerInternal();
    hideTimer();
  }
  
  // 精密なタイマー開始関数
  function startPreciseTimer() {
    // 既存のタイマーをクリア
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // 初期設定
    nextScheduledSecond = timeLeft - 1;
    
    // 高頻度更新タイマー（50ms間隔）
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
        floatingTimerValue.textContent = nextScheduledSecond;
        
        console.log(`Display: 秒変更 - ${nextScheduledSecond}秒を表示`);
        
        // 次の目標秒数を設定
        nextScheduledSecond = Math.max(0, nextScheduledSecond - 1);
        
        // 残り時間に応じた色の変更
        if (timeLeft <= 10) {
          floatingTimer.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
        } else {
          floatingTimer.style.backgroundColor = 'rgba(255, 51, 51, 0.9)';
        }
      }
      
      // タイマー終了処理
      if (remainingMs <= 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }, 50);
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
  
  // クイズの問題を表示する関数
  async function showQuestion(quizId) {
    try {
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
      console.log(`問題表示開始: クイズID ${quizId}`);
      
      // タイマーを内部的にリセット（表示状態は変更しない）
      stopTimerInternal();
      
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
      console.log('問題画面に遷移開始');
      showScreen(quizQuestionScreen);
      console.log('問題画面に遷移完了');
      
      // タイマー待機中なら表示
      if (pendingTimerStart) {
        pendingTimerStart = false;
        console.log('待機中だったタイマーを表示');
        ensureTimerVisible();
        startPreciseTimer();
      }
      
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
      console.log(`解答表示開始: クイズID ${quizId}`);
      
      // 重複呼び出し防止
      if (isTransitioning) {
        console.log('画面遷移中のため、重複した呼び出しを無視します');
        return;
      }
      isTransitioning = true;
      
      // タイマーを停止
      stopTimer();
      
      // 解答情報を取得
      const response = await fetch(`/api/admin/quiz/${quizId}/answer`);
      
      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status}`);
      }
      
      const answerData = await response.json();
      
      // 問題5で答えが空の場合は実践画面に留まる
      if (quizId === '5' && (!answerData.correct_answer || answerData.correct_answer === '')) {
        console.log('問題5: 解答が設定されていません。実践画面に留まります。');
        isTransitioning = false;
        showScreen(practiceScreen);
        return;
      }
      
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
    rankingItem.dataset.playerId = ranking.player_id; // プレイヤーID追加
    
    const positionDiv = document.createElement('div');
    positionDiv.className = 'ranking-position';
    positionDiv.textContent = `${position}位`;
    
    // テーブルナンバーを表示するdiv要素を作成
    const tableDiv = document.createElement('div');
    tableDiv.className = 'ranking-table';
    
    // テーブルナンバーがあれば表示、なければ「-」表示
    // カラーコード化してテーブルごとに色を変える
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
      
      // ランキング画面に切り替え
      showScreen(rankingScreen);
      
      // まだランキングデータを取得していない場合は取得
      if (displayedRankings.length === 0) {
        const response = await fetch('/api/quiz/ranking/all');
        displayedRankings = await response.json();
        
        // ランキングコンテナをクリア
        rankingContainer.innerHTML = '';
      }
      
      // 特定の順位だけを表示する場合
      if (position !== 'all' && position !== 'intro' && !isNaN(parseInt(position))) {
        const positionNum = parseInt(position);
        
        // 修正: 指定された順位のプレイヤーをすべて取得（同率順位対応）
        const sameRankPlayers = displayedRankings.filter(player => player.rank === positionNum);
        
        if (sameRankPlayers.length > 0) {
          // すべての同率プレイヤーを表示
          sameRankPlayers.forEach(ranking => {
            // 既に表示されていなければ追加
            const existingItem = document.querySelector(`.ranking-item[data-player-id="${ranking.player_id}"]`);
            if (!existingItem) {
              const rankingItem = createRankingItem(ranking, ranking.rank);
              // データ属性にプレイヤーIDを追加
              rankingItem.dataset.playerId = ranking.player_id;
              // 先頭に追加
              rankingContainer.insertBefore(rankingItem, rankingContainer.firstChild);
            }
          });
        }
      } else if (position === 'all') {
        // 全表示の場合は上位5位までの異なる順位を表示
        rankingContainer.innerHTML = ''; // コンテナをクリア
        
        // 表示済みの順位を追跡
        const displayedRanks = new Set();
        
        // 順位ごとにグループ化
        const rankGroups = {};
        displayedRankings.forEach(player => {
          if (!rankGroups[player.rank]) {
            rankGroups[player.rank] = [];
          }
          rankGroups[player.rank].push(player);
        });
        
        // 順位順（1位から5位まで）に表示
        const ranks = Object.keys(rankGroups).map(Number).sort((a, b) => a - b);
        for (const rank of ranks) {
          if (rank <= 5) {
            const playersWithRank = rankGroups[rank];
            playersWithRank.forEach(player => {
              const rankingItem = createRankingItem(player, rank);
              rankingItem.dataset.playerId = player.player_id;
              rankingContainer.appendChild(rankingItem);
            });
            displayedRanks.add(rank);
            
            // 5つの異なる順位が表示されたら終了
            if (displayedRanks.size >= 5) {
              break;
            }
          }
        }
      }
      
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
    if (participantCount) {
      participantCount.textContent = `${Math.min(playerCount, 39)}/39`;
    }
    
    console.log('接続統計更新:', stats);
  });
  
  // 精密なタイマー開始イベント処理
  socket.on('precise_timer_start', (data) => {
    const { quizId, startTime, endTime, duration, serverTime } = data;
    
    console.log(`精密タイマー開始イベント - クイズID ${quizId}, 持続時間 ${duration}秒`);
    console.log(`現在の画面ID: ${currentScreen.id}, currentQuizId: ${currentQuizId}`);
    
    // サーバーとの時間差を計算
    const receivedTime = Date.now();
    serverTimeOffset = serverTime - receivedTime;
    
    // 終了時刻をローカル時間に変換
    timerEndTime = endTime - serverTimeOffset;
    
    // タイマーをリセット
    stopTimerInternal();
    timeLeft = duration;
    lastDisplayedTime = duration;
    floatingTimerValue.textContent = duration;
    
    // 問題画面が表示されているかを直接DOMで確認
    const questionScreenVisible = !document.getElementById('quiz-question-screen').classList.contains('hidden');
    
    if (questionScreenVisible && currentQuizId === quizId) {
      console.log('問題画面表示中: タイマーを直接表示');
      ensureTimerVisible();
      startPreciseTimer();
    } else {
      console.log('問題画面以外: タイマー表示を待機状態に');
      pendingTimerStart = true;
    }
  });
  
  // 精密なタイマー同期イベント処理
  socket.on('precise_timer_sync', (data) => {
    const { quizId, remaining, serverTime, secRemaining, isConfirmation } = data;
    
    if (currentQuizId === quizId && currentScreen.id === 'quiz-question-screen') {
      // サーバーとの時間差を更新
      const receivedTime = Date.now();
      serverTimeOffset = serverTime - receivedTime;
      
      // 残り時間を秒に変換（切り上げ）
      const newTimeLeft = secRemaining || Math.ceil(remaining / 1000);
      
      console.log(`Display: 同期 - サーバー残り: ${newTimeLeft}秒, 現在表示: ${lastDisplayedTime}秒`);
      
      // 確認同期または20秒以下は強制的に同期
      if (isConfirmation || newTimeLeft <= 20) {
        timeLeft = newTimeLeft;
        lastDisplayedTime = newTimeLeft;
        floatingTimerValue.textContent = newTimeLeft;
        nextScheduledSecond = newTimeLeft - 1; // 次の秒数を設定
        
        console.log(`Display: 強制同期 - 表示を${newTimeLeft}秒に設定、次は${nextScheduledSecond}秒`);
      } 
      // 通常同期 - 表示の単調減少を維持
      else if (newTimeLeft < lastDisplayedTime) {
        timeLeft = newTimeLeft;
        lastDisplayedTime = newTimeLeft;
        floatingTimerValue.textContent = newTimeLeft;
        nextScheduledSecond = newTimeLeft - 1;
      }
      
      // 残り時間に応じた色の変更
      if (newTimeLeft <= 10) {
        floatingTimer.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
      } else {
        floatingTimer.style.backgroundColor = 'rgba(255, 51, 51, 0.9)';
      }
      
      // 終了時刻の更新
      timerEndTime = receivedTime + remaining;
    }
  });
  
  // 強制遷移イベント処理
  socket.on('force_transition', (data) => {
    const { quizId, target, timestamp, isPractice, fromPractice } = data;
    
    console.log(`[DEBUG-DISPLAY] 強制遷移: target=${target}, QuizID=${quizId}(${typeof quizId}), isPractice=${isPractice}`);
    
    // 問題5の特殊ケースを優先処理 - 型安全な比較
    if (quizId == '5') {
      // 問題5の実践画面への強制遷移
      if (target === 'practice' && isPractice) {
        console.log('[DEBUG-DISPLAY] 問題5の実践待機画面に強制遷移します');
        stopTimer(); // タイマーを停止
        showScreen(practiceScreen);
        return; // 処理を終了
      }
      
      // 問題5の実践画面から解答画面への強制遷移
      if (target === 'answer' && fromPractice) {
        console.log('[DEBUG-DISPLAY] 問題5の実践画面から解答画面への強制遷移');
        showAnswer('5');
        return; // 処理を終了
      }
    }
    
    // 以下は通常の遷移処理
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
    } else if (target === 'practice') {
      // タイマーを停止
      stopTimer();
      
      // 実践待機画面に強制遷移
      console.log('サーバーからの指示により実践待機画面に強制遷移します');
      // 実践待機画面の表示
      showScreen(practiceScreen);
    } else if (target === 'ranking') {
      // ランキング待機画面に遷移
      if (rankingIntroScreen) {
        showScreen(rankingIntroScreen);
      } else {
        // フォールバック
        rankingContainer.innerHTML = '';
        showScreen(rankingScreen);
      }
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
      
      console.log(`Display: 同期遷移イベント - 目標: ${target}, 待機時間: ${waitTime}ms`);
      
      // 指定された時刻まで待ってから遷移
      setTimeout(() => {
        console.log(`Display: 同期遷移実行 - ${target}`);
        
        if (target === 'question' && currentScreen.id === 'quiz-title-screen') {
          showQuestion(currentQuizId);
        }
      }, waitTime);
    }
  });
  
  // クイズイベント処理
  socket.on('quiz_event', (data) => {
    const { event, quizId, position, auto, manual, fromPractice, isPractice } = data;
    
    console.log(`[DEBUG-DISPLAY] イベント受信: ${event}, QuizID: ${quizId}(${typeof quizId}), isPractice: ${isPractice}`);
    
    // 問題5の特殊イベントを優先処理 - 型安全な比較
    if (quizId == '5') {
      // 実践待機画面表示
      if (event === 'show_practice' && isPractice) {
        console.log('[DEBUG-DISPLAY] 問題5実践画面表示処理開始');
        stopTimer(); // タイマーを停止
        showScreen(practiceScreen);
        console.log('[DEBUG-DISPLAY] 問題5実践画面表示完了');
        return; // 処理を終了
      }
      
      // 問題5の実践画面から解答画面への遷移
      if (event === 'show_answer' && fromPractice) {
        console.log('[DEBUG-DISPLAY] 問題5の実践画面から解答画面への遷移');
        showAnswer('5');
        return; // 処理を終了
      }
    }
    
    // 以下は通常のイベント処理
    switch (event) {
      case 'quiz_started':
        console.log('クイズ開始イベント: 説明画面に遷移');
        showScreen(explanationScreen);
        break;
        
      case 'show_question':
        if (quizId) {
          console.log(`問題${quizId}タイトル表示イベント: タイトル画面に遷移`);
          currentQuizId = quizId;
          showScreen(quizTitleScreen);
          quizTitle.textContent = `問題 ${quizId}`;
        }
        break;
        
      case 'next_slide':
        console.log('次へスライドイベント - 現在の画面:', currentScreen.id);
        
        if (currentScreen.id === 'explanation-screen') {
          // 説明画面から最初の問題タイトルへの遷移を処理
          if (currentQuizId) {
            console.log(`説明画面から問題${currentQuizId}タイトル画面に遷移`);
            showScreen(quizTitleScreen);
          }
        }
        else if (currentScreen.id === 'quiz-title-screen' && currentQuizId) {
          console.log(`問題${currentQuizId}タイトル画面から問題画面に遷移`);
          showQuestion(currentQuizId);
        } 
        else if (currentScreen.id === 'quiz-question-screen' && currentQuizId) {
          console.log(`問題${currentQuizId}問題画面から解答画面に遷移`);
          showAnswer(currentQuizId);
        }
        break;
        
      case 'prev_slide':
        if (currentScreen.id === 'quiz-question-screen') {
          stopTimer();
          showScreen(quizTitleScreen);
        } else if (currentScreen.id === 'quiz-answer-screen') {
          showQuestion(currentQuizId);
        }
        break;
        
      case 'show_answer':
        // 追加: 問題5の実践画面からの遷移を特別処理
        if (quizId === '5' && fromPractice) {
          console.log('Display: 問題5の実践画面から解答画面への遷移');
          showAnswer('5');
        } else if (currentQuizId) {
          showAnswer(currentQuizId);
        }
        break;
      
      case 'show_practice':
        // 実践待機画面表示
        if (quizId === '5') {
          console.log('Display: 問題5の実践待機画面を表示');
          showScreen(practiceScreen);
        }
        break;
      
      case 'show_ranking':
        // ランキング表示の改善
        if (position === 'intro') {
          // ランキング準備画面表示 - 文字のみ
          if (rankingIntroScreen) {
            showScreen(rankingIntroScreen);
          } else {
            // rankingIntroScreenが未定義の場合のフォールバック
            // 代わりにrankingScreenを使用し、コンテンツを制限
            rankingContainer.innerHTML = ''; // コンテンツをクリア
            showScreen(rankingScreen);
          }
          console.log('Display: ランキング準備画面を表示');
        } else {
          // 通常のランキング表示
          showRanking(position);
        }
        break;
        
      case 'reset_all':
        goToHome();
        break;
    }
  });
  
  // ホームボタンのクリックイベント
  homeButton.addEventListener('click', goToHome);
  
  // 初期化時にフローティングタイマーの状態を確認
  // タイマーを非表示に設定
  hideTimer();
  console.log('初期化時にタイマーを非表示に設定');
  
  // 初期表示時に参加者数の更新を開始
  if (currentScreen === welcomeScreen) {
    startParticipantCountRefresh();
  }
});