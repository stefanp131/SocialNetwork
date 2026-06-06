const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/test_update_db');
  const schema = new mongoose.Schema({ userId: String, name: String, bio: String, followers: [String] });
  const Model = mongoose.model('TestUser', schema);
  await Model.deleteMany({});
  
  await Model.create({ userId: '1', name: 'Original', bio: 'Old', followers: ['a'] });
  
  // Update without $set
  await Model.findOneAndUpdate({ userId: '1' }, { name: 'New', bio: 'NewBio' }, { new: true, upsert: true });
  
  const doc = await Model.findOne({ userId: '1' });
  console.log("Followers after update:", doc.followers);
  
  await mongoose.disconnect();
}
test().catch(console.error);
