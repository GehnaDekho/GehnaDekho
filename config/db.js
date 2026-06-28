const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Drop old unique indexes to enable partial unique indexing
    const db = conn.connection.db;
    const collections = [
      { name: 'creditconfigs', index: 'actionName_1' },
      { name: 'slots', index: 'slotNumber_1' },
      { name: 'ratingcriterias', index: 'name_1' },
      { name: 'voucherconfigs', index: 'actionName_1' }
    ];

    for (const col of collections) {
      try {
        await db.collection(col.name).dropIndex(col.index);
        console.log(`Dropped index ${col.index} from collection ${col.name}`);
      } catch (err) {
        // Index might not exist or was already dropped, ignore error safely
      }
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
