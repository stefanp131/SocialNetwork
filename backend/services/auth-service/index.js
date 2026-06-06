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
app.listen(PORT, '0.0.0.0', () => console.log(`Auth Service listening on port ${PORT}`));
