// server/routes/quiz.js
const express = require('express');
const router = express.Router();
const db = require('../database/db'); // db.js from direct import

// Retrieve all quizzes
router.get('/', async (req, res) => {
  try {
    const quizzes = await db.getAllQuizzes();
    
    // Convert options from JSON string to array
    const formattedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      options: JSON.parse(quiz.options)
    }));
    
    res.json(formattedQuizzes);
  } catch (error) {
    console.error('Error retrieving quizzes:', error);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// Retrieve a specific quiz (without answers)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await db.getQuiz(id);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Create a safe version without answer information
    const safeQuiz = {
      id: quiz.id,
      question: quiz.question,
      options: JSON.parse(quiz.options),
      question_image_path: quiz.question_image_path,
      is_image_options: quiz.is_image_options
    };
    
    res.json(safeQuiz);
  } catch (error) {
    console.error('Error retrieving quiz:', error);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// Start a quiz session
router.post('/start/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify quiz exists
    const quiz = await db.getQuiz(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Start a new session
    const result = await db.startQuizSession(id);
    
    res.json(result);
  } catch (error) {
    console.error('Error starting quiz session:', error);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// Get quiz statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await db.getQuizStats(id);
    
    if (!stats) {
      return res.status(404).json({ 
        quizId: parseInt(id),
        totalParticipants: 0,
        correctAnswers: 0,
        stats: []
      });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error retrieving quiz statistics:', error);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// Get number of participants
router.get('/stats/participants', async (req, res) => {
  try {
    const count = await db.getParticipantCount();
    res.json({ count });
  } catch (error) {
    console.error('Error retrieving participant count:', error);
    res.status(500).json({ error: 'Server error occurred', count: 0 });
  }
});

// Get rankings
router.get('/ranking/all', async (req, res) => {
  try {
    const rankings = await db.getRankings();
    res.json(rankings);
  } catch (error) {
    console.error('Error retrieving rankings:', error);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// Check if answer is available for a quiz
router.get('/:id/answer-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if answer is available
    const isAnswerAvailable = await db.isQuizAnswerAvailable(id);
    
    res.json({ 
      quizId: id,
      isAnswerAvailable 
    });
  } catch (error) {
    console.error('Error checking answer availability status:', error);
    res.status(500).json({ 
      error: 'Server error occurred', 
      isAnswerAvailable: false 
    });
  }
});

// Update answer display status
router.post('/:id/mark-answer-displayed', async (req, res) => {
  try {
    const { id } = req.params;
    const { displayed } = req.body;
    
    // Update answer display status
    const result = await db.markQuizAnswerDisplayed(id, displayed);
    
    res.json({ 
      success: result,
      quizId: id,
      answerDisplayed: displayed 
    });
  } catch (error) {
    console.error('Error updating answer display status:', error);
    res.status(500).json({ 
      error: 'Server error occurred',
      success: false
    });
  }
});

module.exports = router;