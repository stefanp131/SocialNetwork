const fs = require('fs');
const path = require('path');

const services = ['auth-service', 'user-service', 'post-service'];
for (const service of services) {
  const indexJs = path.join(__dirname, '..', service, 'index.js');
  let content = fs.readFileSync(indexJs, 'utf8');

  // Change mongoose.connect to add directConnection=true when using IP
  content = content.replace(
    /await mongoose\.connect\(mongoUrl\.toString\(\)\);/,
    `mongoUrl.searchParams.set('directConnection', 'true');\n    await mongoose.connect(mongoUrl.toString());`
  );
  
  fs.writeFileSync(indexJs, content);
}
console.log('Patched backend services with directConnection=true');
