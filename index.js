// index.js
const { spawn } = require('child_process');
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 5000;

// Serve QR code statically
app.use('/qr', express.static(__dirname));

// Basic endpoint to confirm server is alive
app.get('/', (req, res) => res.send('✅ Server is running!'));

// Start WhatsApp bot in background
spawn('node', ['whatsapp-bot.js'], {
  stdio: 'inherit',
  shell: true,
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
});
