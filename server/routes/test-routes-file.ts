// Test routes file for deterministic analysis
// This file should trigger both "backend" and "routes" labels

import express from 'express';

const router = express.Router();
const router2 = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Test route' });
});

const router2 = express.Router();

const router2 = express.Router();


export default router;

