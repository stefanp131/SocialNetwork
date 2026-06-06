const fs = require('fs');
const path = require('path');

const services = ['auth-service', 'user-service', 'post-service'];
for (const service of services) {
  const indexJs = path.join(__dirname, '..', service, 'index.js');
  let content = fs.readFileSync(indexJs, 'utf8');

  // Revert connectMongo
  const connectMongoRegex = /async function connectMongo\(\) \{[\s\S]*?(?=\}\s*connectMongo\(\);)\} /;
  
  const originalConnectMongo = `async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(process.env.PORT ? 'Service connected to MongoDB' : 'Connected to MongoDB');
`;
  // I need a robust replacement
}
