const dns = require('dns').promises;
const net = require('net');

async function test() {
  try {
    const { address } = await dns.lookup('mongodb', { family: 4 });
    console.log('Resolved IP:', address);

    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(27017, address, function() {
        console.log('Connected directly to IP!');
        client.destroy();
    });

    client.on('error', function(err) {
        console.error('Connection error:', err);
    });

    client.on('timeout', function() {
        console.error('Connection timeout');
        client.destroy();
    });

  } catch (err) {
    console.error('DNS error:', err);
  }
}
test();
