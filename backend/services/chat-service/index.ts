try {
  if (!global.crypto) {
    (global as any).crypto = require('crypto');
  }
} catch (e) {}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chat_db';

let isServerStarted = false;
let hasMongoConnected = false;
let mongoReconnectTimer;

function scheduleMongoReconnect() {
  if (mongoReconnectTimer || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
  mongoReconnectTimer = setTimeout(function () {
    mongoReconnectTimer = undefined;
    connectMongo();
  }, 3000);
}

function startServer() {
  if (isServerStarted) return;
  isServerStarted = true;
  app.listen(PORT, '0.0.0.0', function () {
    console.log('Chat Service listening on port ' + PORT);
  });
}

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    hasMongoConnected = true;
    console.log('Chat Service connected to MongoDB');
    startServer();
  } catch (err) {
    console.error('MongoDB connection error, retrying in 3s...', err.message);
    scheduleMongoReconnect();
  }
}

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 60000);
mongoose.connection.on('disconnected', function () {
  console.error('MongoDB disconnected. Reconnecting...');
  scheduleMongoReconnect();
});
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error:', err.message);
});

connectMongo();

app.use(function (req, res, next) {
  if (!hasMongoConnected) return res.status(503).json({ error: 'MongoDB is not connected yet' });
  next();
});

// Schema
// conversationKey: sorted "userA:userB" so both directions share the same thread
const MessageSchema = new mongoose.Schema({
  conversationKey: { type: String, required: true, index: true },
  senderId:        { type: String, required: true },
  receiverId:      { type: String, required: true },
  text:            { type: String, required: true },
  status:          { type: String, enum: ['sent', 'seen'], default: 'sent' },
  createdAt:       { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

function makeKey(a, b) {
  return [a, b].sort().join(':');
}

// GET /conversations/:userId  — list of conversations (most recent message per thread)
app.get('/conversations/:userId', async function (req, res) {
  try {
    const userId = req.params.userId;
    const messages = await Message.aggregate([
      { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationKey',
          lastMessage: { $first: '$$ROOT' },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    const conversations = messages.map(function (m) {
      const other = m.lastMessage.senderId === userId ? m.lastMessage.receiverId : m.lastMessage.senderId;
      return {
        conversationKey: m._id,
        partnerId: other,
        lastMessage: m.lastMessage,
      };
    });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /notifications/:userId  — unread message count + unread senders
app.get('/notifications/:userId', async function (req, res) {
  try {
    const userId = req.params.userId;

    const unreadBySender = await Message.aggregate([
      { $match: { receiverId: userId, status: 'sent' } },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 },
          latestAt: { $max: '$createdAt' },
        },
      },
      { $sort: { latestAt: -1 } },
    ]);

    const unreadTotal = unreadBySender.reduce(function (acc, item) {
      return acc + item.count;
    }, 0);

    const normalized = unreadBySender.map(function (item) {
      return {
        senderId: item._id,
        count: item.count,
        latestAt: item.latestAt,
      };
    });

    res.json({ unreadTotal: unreadTotal, unreadBySender: normalized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /messages/:userA/:userB  — full message thread
app.get('/messages/:userA/:userB', async function (req, res) {
  try {
    const key = makeKey(req.params.userA, req.params.userB);
    const messages = await Message.find({ conversationKey: key }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /messages  — send a message { senderId, receiverId, text }
app.post('/messages', async function (req, res) {
  try {
    const senderId   = req.body.senderId;
    const receiverId = req.body.receiverId;
    const text       = req.body.text;
    if (!senderId || !receiverId || !(text && text.trim())) {
      return res.status(400).json({ error: 'senderId, receiverId and text are required' });
    }
    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    const conversationKey = makeKey(senderId, receiverId);
    const msg = await Message.create({ conversationKey: conversationKey, senderId: senderId, receiverId: receiverId, text: text.trim() });
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /messages/seen  — mark all unseen messages in a thread as seen { viewerId, partnerId }
app.patch('/messages/seen', async function (req, res) {
  try {
    const viewerId  = req.body.viewerId;
    const partnerId = req.body.partnerId;
    if (!viewerId || !partnerId) {
      return res.status(400).json({ error: 'viewerId and partnerId are required' });
    }
    const key = makeKey(viewerId, partnerId);
    await Message.updateMany(
      { conversationKey: key, receiverId: viewerId, status: 'sent' },
      { $set: { status: 'seen' } }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
