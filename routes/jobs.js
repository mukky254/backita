const express = require('express');
const router = express.Router();

// Temporary routes for testing
router.get('/', (req, res) => {
  res.json({ message: 'Get all jobs endpoint working' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create job endpoint working' });
});

module.exports = router;
