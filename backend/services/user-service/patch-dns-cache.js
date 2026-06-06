const fs = require('fs');
const path = require('path');

const services = ['auth-service', 'user-service', 'post-service'];

const cacheLogic = `
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
`;

for (const service of services) {
  const indexJs = path.join(__dirname, '..', service, 'index.js');
  let content = fs.readFileSync(indexJs, 'utf8');

  if (!content.includes('const originalLookup = dns.lookup;')) {
    content = content.replace("dns.setDefaultResultOrder('ipv4first');", "dns.setDefaultResultOrder('ipv4first');\n" + cacheLogic);
    fs.writeFileSync(indexJs, content);
  }
}
console.log('Patched backend services with DNS cache');
