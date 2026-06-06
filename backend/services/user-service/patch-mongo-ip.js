const fs = require('fs');
const path = require('path');

const services = ['auth-service', 'user-service', 'post-service'];
for (const service of services) {
  const indexJs = path.join(__dirname, '..', service, 'index.js');
  let content = fs.readFileSync(indexJs, 'utf8');

  // We want to replace the connectMongo() function with one that resolves the IP
  const newConnectMongo = `
const util = require('util');
const dnsPromises = dns.promises;

async function connectMongo() {
  try {
    const mongoUrl = new URL(MONGO_URI);
    if (mongoUrl.hostname !== 'localhost' && mongoUrl.hostname !== '127.0.0.1') {
      const { address } = await dnsPromises.lookup(mongoUrl.hostname, { family: 4 });
      mongoUrl.hostname = address;
      console.log('Resolved MongoDB IP:', address);
    }
    await mongoose.connect(mongoUrl.toString());
    console.log(process.env.PORT ? 'Service connected to MongoDB' : 'Connected to MongoDB');
`;
  
  if (!content.includes('dnsPromises.lookup')) {
    // Find the connectMongo function
    const connectMongoRegex = /async function connectMongo\(\) \{\s*try \{\s*await mongoose\.connect\(MONGO_URI\);\s*console\.log\('[^']+'\);\s*/;
    content = content.replace(connectMongoRegex, newConnectMongo);
    fs.writeFileSync(indexJs, content);
  }
}
console.log('Patched backend services with IP resolution');
