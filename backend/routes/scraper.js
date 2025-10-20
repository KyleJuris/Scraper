const express = require('express');
const router = express.Router();

// Minimal route file per your scaffold.
// No manual triggers (auto-run handled in server startup).
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
