const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from the server root
dotenv.config({ path: path.join(__dirname, "../.env") });

const CreditConfig = require("../models/CreditConfig");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const addConfigs = async () => {
  await connectDB();

  try {
    const configs = [
      {
        actionName: "feedback_unlock_fee",
        creditsRequired: 2,
        description: "Fee to unlock private customer feedback",
      },
      {
        actionName: "booking_reveal_fee",
        creditsRequired: 2,
        description: "Fee to reveal customer booking details",
      },
    ];

    for (const config of configs) {
      await CreditConfig.findOneAndUpdate(
        { actionName: config.actionName },
        { $set: config },
        { upsert: true, new: true },
      );
      console.log(`Added/Updated credit config: ${config.actionName}`);
    }

    console.log("Successfully added new credit configs.");
  } catch (error) {
    console.error(`Error adding configs: ${error.message}`);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
};

addConfigs();
