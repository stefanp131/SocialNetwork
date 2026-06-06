global.crypto = require('crypto');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const originalLookup = dns.lookup;
const dnsCache = new Map();
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname === 'mongodb' && dnsCache.has(hostname)) {
    return callback(null, dnsCache.get(hostname), 4);
  }
  originalLookup(hostname, options, (err, address, family) => {
    if (!err && hostname === 'mongodb') {
      dnsCache.set(hostname, address);
    }
    callback(err, address, family);
  });
};

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


async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    if (typeof connectRabbitMQ === 'function') connectRabbitMQ();
  } catch (err) {
    console.error('MongoDB connection error, retrying in 3s...', err.message);
    setTimeout(connectMongo, 3000);
  }
}
connectMongo();

const PostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
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

app.listen(PORT, '0.0.0.0', () => console.log(`Post Service listening on port ${PORT}`));
