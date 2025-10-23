const express = require('express');
const router = express.Router();

// Temporary routes for testing
router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint working' });
});

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint working' });
});

module.exports = router;
