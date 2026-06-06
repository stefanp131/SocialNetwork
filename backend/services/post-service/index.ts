try {
  if (!global.crypto) {
    (global as any).crypto = require('crypto');
  }
} catch (e) {}

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
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:4002';
let isServerStarted = false;
let hasMongoConnected = false;
let mongoReconnectTimer;

async function getFollowedUsers(viewer: string): Promise<string[]> {
  if (!viewer) return [];
  try {
    const response = await fetch(`${USER_SERVICE_URL}/${viewer}`);
    if (!response.ok) {
      console.error(`Failed to fetch user profile for ${viewer}: ${response.statusText}`);
      return [];
    }
    const data: any = await response.json();
    return data.following || [];
  } catch (error) {
    console.error(`Error fetching followed users for ${viewer}:`, error);
    return [];
  }
}

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
    const filter: any = {};
    const viewer = req.query.viewer as string;
    const followedUsers = viewer ? await getFollowedUsers(viewer) : [];

    if (req.query.userIds) {
      // Fetch posts for multiple users (Our Space)
      const usersArray = (req.query.userIds as string).split(',');
      filter.userId = { $in: usersArray };
      filter.$or = [
        { visibility: 'public' },
        { userId: viewer },
        { userId: { $in: followedUsers } }
      ];
    } else if (req.query.userId) {
      // Fetch posts for single user (Profile / My Space)
      filter.userId = req.query.userId;
      filter.$or = [
        { visibility: 'public' },
        { userId: viewer },
        { userId: { $in: followedUsers } }
      ];
    } else {
      // Global feed (if ever needed)
      filter.$or = [
        { visibility: 'public' },
        { userId: viewer },
        { userId: { $in: followedUsers } }
      ];
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

    // Enforce post visibility rules
    if (post.visibility === 'private' && post.userId !== userId) {
      const followedUsers = await getFollowedUsers(userId);
      if (!followedUsers.includes(post.userId)) {
        return res.status(403).json({ error: 'You do not have permission to access this post' });
      }
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
