const fs = require('fs');
const path = require('path');

const services = ['auth-service', 'user-service', 'post-service'];
for (const service of services) {
  const indexJs = path.join(__dirname, '..', service, 'index.js');
  let content = fs.readFileSync(indexJs, 'utf8');
  
  if (!content.includes("dns.setDefaultResultOrder('ipv4first')")) {
    // Add it after the requires
    content = content.replace(/(const express = require\('express'\);)/, "const dns = require('node:dns');\ndns.setDefaultResultOrder('ipv4first');\n$1");
  }
  
  // Also clean up { family: 4 } since Mongoose 9 ignores it and it's better to rely on setDefaultResultOrder
  content = content.replace(/, \{ family: 4 \}/g, '');
  
  fs.writeFileSync(indexJs, content);
}
console.log('Patched backend services with ipv4first override');
