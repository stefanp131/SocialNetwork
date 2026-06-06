(global as any).crypto = require('crypto');

const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/user_db';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

let channel;
let isServerStarted = false;
let hasMongoConnected = false;
let mongoReconnectTimer;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('USER_EVENTS');
    console.log('User Service connected to RabbitMQ');
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
}

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 60000);

function scheduleMongoReconnect() {
  if (mongoReconnectTimer || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  mongoReconnectTimer = setTimeout(() => {
    mongoReconnectTimer = undefined;
    connectMongo();
  }, 3000);
}

function startServer() {
  if (isServerStarted) {
    return;
  }

  isServerStarted = true;
  app.listen(PORT, '0.0.0.0', () => console.log(`User Service listening on port ${PORT}`));
}

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    hasMongoConnected = true;
    console.log('Connected to MongoDB');
    if (!isServerStarted && typeof connectRabbitMQ === 'function') connectRabbitMQ();
    startServer();
  } catch (err) {
    console.error('MongoDB connection error, retrying in 3s...', err.message);
    scheduleMongoReconnect();
  }
}

mongoose.connection.on('connected', () => {
  hasMongoConnected = true;
});

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected. Reconnecting in 3s...');
  scheduleMongoReconnect();
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

connectMongo();

app.use((req, res, next) => {
  if (!hasMongoConnected) {
    return res.status(503).json({ error: 'MongoDB is not connected yet' });
  }
  next();
});

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: String,
  bio: String,
  profileImage: { type: String, default: '' },
  following: { type: [String], default: [] },
  followers: { type: [String], default: [] }
});
const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

app.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);
    const regex = new RegExp(q, 'i');
    const users = await UserProfile.find({
      $or: [{ userId: regex }, { name: regex }]
    }).limit(20);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/:id', async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.params.id });
    res.json(profile || { following: [], followers: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/:id', async (req, res) => {
  try {
    const { name, bio, profileImage } = req.body;
    const profile = await UserProfile.findOneAndUpdate(
      { userId: req.params.id },
      { $set: { name, bio, profileImage: profileImage || '' } },
      { new: true, upsert: true }
    );
    
    if (channel) {
      channel.sendToQueue('USER_EVENTS', Buffer.from(JSON.stringify({ event: 'USER_UPDATED', data: profile })));
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Bio update error:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.post('/:id/follow', async (req, res) => {
  try {
    const { followerId } = req.body; // user who is following
    const targetId = req.params.id; // user to be followed

    // Add targetId to follower's following list
    await UserProfile.findOneAndUpdate(
      { userId: followerId },
      { $addToSet: { following: targetId } },
      { upsert: true }
    );

    // Add followerId to target's followers list
    const updatedTarget = await UserProfile.findOneAndUpdate(
      { userId: targetId },
      { $addToSet: { followers: followerId } },
      { new: true, upsert: true }
    );

    res.json(updatedTarget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/:id/unfollow', async (req, res) => {
  try {
    const { followerId } = req.body;
    const targetId = req.params.id;

    await UserProfile.findOneAndUpdate(
      { userId: followerId },
      { $pull: { following: targetId } }
    );

    const updatedTarget = await UserProfile.findOneAndUpdate(
      { userId: targetId },
      { $pull: { followers: followerId } },
      { new: true }
    );

    res.json(updatedTarget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
