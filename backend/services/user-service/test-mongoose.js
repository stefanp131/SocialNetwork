const mongoose = require('mongoose');

async function test() {
  const schema = new mongoose.Schema({ name: String, bio: String });
  const Model = mongoose.model('Test', schema);
  console.log("Model created");
}
test();
