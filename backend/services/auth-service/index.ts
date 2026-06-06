(global as any).crypto = require('crypto');

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
let isServerStarted = false;
let hasMongoConnected = false;
let mongoReconnectTimer;

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
  app.listen(PORT, '0.0.0.0', () => console.log(`Auth Service listening on port ${PORT}`));
}

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    hasMongoConnected = true;
    console.log('Connected to MongoDB');
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

// Simplified User schema for Auth purposes
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);
    const regex = new RegExp(q, 'i');
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }]
    }).limit(20);
    const mappedUsers = users.map(u => ({ userId: u.username, name: u.username }));
    res.json(mappedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
