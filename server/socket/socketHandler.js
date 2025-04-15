// server/socket/socketHandler.js
const { getDb } = require('../database/db');

// Socket connection management
let activeConnections = {
  display: null, // Main display connection
  admin: [],     // Admin connections
  players: {}    // Player connections (player_id: socket)
};

// Active connection counter
let connectionCounter = {
  total: 0,
  players: 0
};

function setupSocketHandlers(io) {
  // Save io to global for broadcasting
  global.io = io;
  
  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    connectionCounter.total++;
    
    // Connection type registration
    socket.on('register', (data) => {
      const { type, playerId = null } = data;
      
      // Process based on connection type
      switch (type) {
        case 'display':
          // Allow only one display connection
          if (activeConnections.display) {
            // Disconnect old connection
            const oldSocket = activeConnections.display;
            oldSocket.emit('connection_rejected', { reason: 'New display connection detected' });
          }
          activeConnections.display = socket;
          socket.emit('registered', { type });
          console.log('Display connection registered');
          break;
          
        case 'admin':
          activeConnections.admin.push(socket);
          socket.emit('registered', { type });
          // Send current connection status
          socket.emit('connection_stats', {
            total: connectionCounter.total,
            players: connectionCounter.players
          });
          console.log('Admin connection registered');
          break;
          
        case 'player':
          if (!playerId) {
            socket.emit('registration_error', { message: 'Player ID required' });
            return;
          }
          
          activeConnections.players[playerId] = socket;
          connectionCounter.players++;
          
          socket.emit('registered', { type, playerId });
          
          // Broadcast player count update
          broadcastConnectionStats();
          
          console.log(`Player connection registered: ${playerId}`);
          break;
          
        default:
          socket.emit('registration_error', { message: 'Unknown connection type' });
      }
    });
    
    // Quiz control commands (admin)
    socket.on('quiz_command', async (data) => {
      const { command, quizId, params = {} } = data;
      
      // Verify admin status
      if (!activeConnections.admin.includes(socket)) {
        socket.emit('command_error', { message: 'Insufficient permissions' });
        return;
      }
      
      switch (command) {
        case 'start_quiz':
          // Broadcast quiz start
          io.emit('quiz_event', { 
            event: 'quiz_started', 
            quizId 
          });
          console.log(`Quiz started`);
          break;
          
        case 'show_question':
          // Broadcast question display
          io.emit('quiz_event', { 
            event: 'show_question', 
            quizId 
          });
          console.log(`Quiz ${quizId} question displayed`);
          break;
          
        case 'show_answer':
          // Broadcast answer display
          io.emit('quiz_event', { 
            event: 'show_answer', 
            quizId 
          });
          console.log(`Quiz ${quizId} answer displayed`);
          break;
          
        case 'show_ranking':
          // Broadcast ranking display
          io.emit('quiz_event', { 
            event: 'show_ranking',
            position: params.position || 'all'
          });
          console.log(`Ranking displayed: ${params.position || 'all'}`);
          break;
          
        case 'next_slide':
          // Advance to next slide
          io.emit('quiz_event', { 
            event: 'next_slide' 
          });
          console.log('Advanced to next slide');
          break;
          
        case 'prev_slide':
          // Return to previous slide
          io.emit('quiz_event', { 
            event: 'prev_slide' 
          });
          console.log('Returned to previous slide');
          break;
          
        case 'reset_all':
          // Send reset command
          io.emit('quiz_event', {
            event: 'reset_all'
          });
          console.log('All data has been reset');
          break;
          
        case 'time_expired':
          // Broadcast timer expiration event
          io.emit('quiz_event', { 
            event: 'time_expired', 
            quizId 
          });
          
          // Update session timer expiration flag
          try {
            const db = require('../database/db');
            await db.markQuizTimerExpired(quizId, true);
          } catch (error) {
            console.error(`Error updating timer expiration flag for quiz ${quizId}:`, error);
          }
          
          console.log(`Timer expired for quiz ${quizId}`);
          break;
          
        default:
          socket.emit('command_error', { message: 'Unknown command' });
      }
    });
    
    // Answer submission event (player)
    socket.on('submit_answer', (data) => {
      const { playerId, quizId, answer } = data;
      
      // Verify player registration
      let isRegisteredPlayer = false;
      Object.entries(activeConnections.players).forEach(([id, s]) => {
        if (s === socket && id === playerId) {
          isRegisteredPlayer = true;
        }
      });
      
      if (!isRegisteredPlayer) {
        socket.emit('answer_error', { message: 'Unregistered player' });
        return;
      }
      
      // Notify of answer submission (actual recording is handled by API)
      io.emit('answer_submitted', {
        playerId,
        quizId
      });
      
      // Notify admins of answer status
      activeConnections.admin.forEach(adminSocket => {
        adminSocket.emit('answer_update', {
          playerId,
          quizId,
          answer
        });
      });
    });
    
    // Request to show answer (player)
    socket.on('request_show_answer', (data) => {
      const { quizId } = data;
      
      // Only notify admins - they can decide whether to show the answer
      activeConnections.admin.forEach(adminSocket => {
        adminSocket.emit('answer_requested', {
          quizId,
          socketId: socket.id
        });
      });
    });
    
    // Return to home screen
    socket.on('go_home', () => {
      socket.emit('go_home_event');
    });
    
    // Disconnection handling
    socket.on('disconnect', () => {
      console.log(`Connection disconnected: ${socket.id}`);
      connectionCounter.total--;
      
      // Remove from connection list
      if (activeConnections.display === socket) {
        activeConnections.display = null;
      }
      
      const adminIndex = activeConnections.admin.indexOf(socket);
      if (adminIndex !== -1) {
        activeConnections.admin.splice(adminIndex, 1);
      }
      
      let playerIdToRemove = null;
      Object.entries(activeConnections.players).forEach(([playerId, s]) => {
        if (s === socket) {
          playerIdToRemove = playerId;
        }
      });
      
      if (playerIdToRemove) {
        delete activeConnections.players[playerIdToRemove];
        connectionCounter.players--;
        broadcastConnectionStats();
      }
    });
  });
}

// Broadcast connection statistics
function broadcastConnectionStats() {
  const io = global.io;
  if (!io) return;
  
  const stats = {
    total: connectionCounter.total,
    players: connectionCounter.players
  };
  
  // Notify display and admins
  if (activeConnections.display) {
    activeConnections.display.emit('connection_stats', stats);
  }
  
  activeConnections.admin.forEach(socket => {
    socket.emit('connection_stats', stats);
  });
}

module.exports = {
  setupSocketHandlers
};