const dns = require('dns');
setInterval(() => {
  dns.lookup('mongodb', { family: 4 }, (err, address) => {
    if (err) console.error(new Date().toISOString(), 'DNS Error:', err.message);
    else console.log(new Date().toISOString(), 'DNS Success:', address);
  });
}, 1000);
