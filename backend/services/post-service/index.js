global.crypto = require('crypto');

const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/post_db';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
let isServerStarted = false;
let hasMongoConnected = false;
let mongoReconnectTimer;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue('USER_EVENTS');
    console.log('Post Service connected to RabbitMQ');
    
    channel.consume('USER_EVENTS', (msg) => {
      if (msg !== null) {
        const event = JSON.parse(msg.content.toString());
        console.log('Received event from RabbitMQ:', event);
        // In a real application, you might update denormalized user data in posts
        channel.ack(msg);
      }
    });
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
  app.listen(PORT, '0.0.0.0', () => console.log(`Post Service listening on port ${PORT}`));
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

const PostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  likes: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

app.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.userIds) {
      // Fetch posts for multiple users (Our Space)
      const usersArray = req.query.userIds.split(',');
      filter.userId = { $in: usersArray };
      filter.visibility = 'public'; // Only public posts for feed
    } else if (req.query.userId) {
      // Fetch posts for single user (Profile / My Space)
      filter.userId = req.query.userId;
      // If viewer is the owner, show all posts. Otherwise only public.
      if (req.query.viewer !== req.query.userId) {
        filter.visibility = 'public';
      }
    } else {
      // Global feed (if ever needed)
      filter.visibility = 'public';
    }

    const posts = await Post.find(filter).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/', async (req, res) => {
  try {
    const { userId, content, visibility } = req.body;
    const post = new Post({ userId, content, visibility: visibility || 'public' });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId === userId) {
      return res.status(400).json({ error: 'You cannot like your own post' });
    }

    const alreadyLiked = (post.likes || []).includes(userId);
    const update = alreadyLiked
      ? { $pull: { likes: userId } }
      : { $addToSet: { likes: userId } };

    const updatedPost = await Post.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ post: updatedPost, liked: !alreadyLiked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
