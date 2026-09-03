// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");
// const { protect } = require("../middleware/authMiddleware");

// // Ensure uploads directory exists
// const uploadDir = path.join(__dirname, "..", "uploads");
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// // Configure multer storage
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const folder = req.query.folder || req.body.folder || "general";
//     const destDir = path.join(__dirname, "..", "uploads", folder);

//     if (!fs.existsSync(destDir)) {
//       fs.mkdirSync(destDir, { recursive: true });
//     }

//     req.uploadFolder = folder;
//     cb(null, destDir);
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   },
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype.startsWith("image/") ||
//     file.mimetype.startsWith("video/")
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only images and videos are allowed!"), false);
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: { fileSize: 2 * 1024 * 1024 }, // 50MB limit
// });

// /**
//  * @desc    Upload an image
//  * @route   POST /api/upload
//  * @access  Private
//  */
// router.post("/", protect, upload.single("image"), (req, res) => {
//   try {
//     if (!req.file) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Please upload a file" });
//     }

//     // Construct the public URL for the uploaded file
//     // In a production environment, this would be your server domain or cloud storage URL.
//     // We assume the app is hosted on the domain defined by the request host.
//     const protocol = req.protocol;
//     const host = req.get("host");
//     const folder = req.uploadFolder || "general";
//     const imageUrl = `${protocol}://${host}/uploads/${folder}/${req.file.filename}`;

//     res.status(200).json({
//       success: true,
//       message: "Image uploaded successfully",
//       imageUrl: imageUrl,
//     });
//   } catch (error) {
//     console.error("Error during image upload:", error);
//     res
//       .status(500)
//       .json({ success: false, message: "Server error during upload" });
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");

// Base uploads directory
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Folder can be passed as query (?folder=products)
    // or in body (folder=products)
    const folder = req.query.folder || req.body.folder || "general";

    const destination = path.join(uploadDir, folder);

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    req.uploadFolder = folder;

    cb(null, destination);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Allow only images & videos
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum allowed by multer
  },
});

/**
 * @desc Upload Image/Video
 * @route POST /api/upload
 * @access Private
 *
 * Example:
 * POST /api/upload?folder=products
 * POST /api/upload?folder=reels
 */
router.post("/", protect, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }

    const folder = req.uploadFolder || "general";

    let maxLimit = 2 * 1024 * 1024; // 2MB default
    let maxLimitStr = "2MB";

    if (folder === "reels") {
      maxLimit = 10 * 1024 * 1024; // 10MB for reels
      maxLimitStr = "10MB";
    }

    // Enforce size limit
    if (req.file.size > maxLimit) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(413).json({
        success: false,
        message: `File size exceeds ${maxLimitStr} limit`,
      });
    }

    const imageUrl = `${process.env.BASE_URL}/uploads/${folder}/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      imageUrl,
      filename: req.file.filename,
      folder,
    });
  } catch (error) {
    console.error("Upload Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during upload",
    });
  }
});

module.exports = router;
