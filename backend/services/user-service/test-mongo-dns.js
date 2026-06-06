const dns = require('dns');
dns.lookup('mongodb', (err, address, family) => {
  console.log('lookup:', err, address, family);
});
