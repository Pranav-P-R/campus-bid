const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initDb } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

// Services
const auctionEngine = require('./services/auctionEngine');
const closerJob = require('./services/closerJob');
const notificationService = require('./services/notificationService');

// Routes
const authRoutes = require('./routes/auth');
const { router: auctionsRoutes, setSocketIo: setAuctionsSocketIo } = require('./routes/auctions');
const bidsRoutes = require('./routes/bids');
const { router: questionsRoutes, setSocketIo: setQuestionsSocketIo } = require('./routes/questions');
const { router: salesRoutes, setSocketIo: setSalesSocketIo } = require('./routes/sales');
const savedSearchesRoutes = require('./routes/savedSearches');
const notificationsRoutes = require('./routes/notifications');
const assistantRoutes = require('./routes/assistant');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

// Pass Socket.IO instance to all engines and routes
auctionEngine.setSocketIo(io);
closerJob.setSocketIo(io);
notificationService.setSocketIo(io);
setAuctionsSocketIo(io);
setQuestionsSocketIo(io);
setSalesSocketIo(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Join auction room for live bid updates and countdowns
  socket.on('join_auction', (auctionId) => {
    if (auctionId) {
      socket.join(`auction:${auctionId}`);
    }
  });

  socket.on('leave_auction', (auctionId) => {
    if (auctionId) {
      socket.leave(`auction:${auctionId}`);
    }
  });

  // User-specific room for notifications
  socket.on('auth_user', (token) => {
    try {
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.join(`user:${decoded.userId}`);
      }
    } catch (e) {
      // Invalid token - ignore
    }
  });

  socket.on('disconnect', () => {
    // Clean up
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api/auctions', bidsRoutes);
app.use('/api/auctions', questionsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/saved-searches', savedSearchesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded photos statically
const uploadsPath = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve static frontend build if it exists
const distPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('CampusBid API Server Running. Please start the client dev server or run npm run build.');
      }
    });
  }
  next();
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initDb();

    // Start background closer worker (checks every 2.5 seconds)
    closerJob.startAuctionCloser(2500);

    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 CampusBid API Server running on port ${PORT}`);
      console.log(`📡 WebSocket server initialized`);
      console.log(`⏱️ Auction closing engine active`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };
