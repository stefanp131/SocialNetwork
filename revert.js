const fs = require('fs');
const path = require('path');
const services = ['auth-service', 'user-service', 'post-service'];

for (const service of services) {
  const indexJs = path.join(__dirname, 'backend/services', service, 'index.js');
  let content = fs.readFileSync(indexJs, 'utf8');

  // Revert the entire block
  content = content.replace(/const util = require\('util'\);[\s\S]*?connectMongo\(\);/,
`async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    if (typeof connectRabbitMQ === 'function') connectRabbitMQ();
  } catch (err) {
    console.error('MongoDB connection error, retrying in 3s...', err.message);
    setTimeout(connectMongo, 3000);
  }
}
connectMongo();`);
  
  fs.writeFileSync(indexJs, content);
}
console.log('Reverted IP patches');
