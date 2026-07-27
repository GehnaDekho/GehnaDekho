const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

class FirebaseService {
  constructor() {
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) return;

    try {
      const serviceAccountPath = path.resolve(
        __dirname,
        "../config/admin-firebase.js",
      );

      if (!fs.existsSync(serviceAccountPath)) {
        console.warn(
          "⚠️ Firebase Admin SDK config not found at config/admin-firebase.js. Push notifications will fail.",
        );
        return;
      }

      const serviceAccount = require(serviceAccountPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.isInitialized = true;
      console.log("🔥 Firebase Admin SDK Initialized Successfully");
    } catch (error) {
      console.error("❌ Error initializing Firebase Admin SDK:", error);
    }
  }

  getMessaging() {
    if (!this.isInitialized) {
      throw new Error("Firebase Admin SDK is not initialized.");
    }
    return admin.messaging();
  }
}

// Export as singleton
module.exports = new FirebaseService();
