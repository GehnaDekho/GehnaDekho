const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a brand name'],
      unique: true,
      trim: true
    },
    logo: {
      type: String,
      required: [true, 'Please add a brand logo image URL']
    },
    tagline: {
      type: String,
      trim: true
    },
    establishedYear: {
      type: String,
      trim: true
    },
    showOnHomeScreen: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Embedded dynamic sections for the Brand Heritage/Details page
    sections: [
      {
        type: {
          type: String,
          enum: ['hero', 'timeline', 'artistry', 'accolades', 'trust_banner'],
          required: true
        },
        order: {
          type: Number,
          default: 0
        },
        isActive: {
          type: Boolean,
          default: true
        },
        // Content fields
        title: { type: String },
        subtitle: { type: String },
        description: { type: String },
        backgroundImage: { type: String },
        
        // For 'timeline' type
        milestones: [
          {
            year: { type: String },
            title: { type: String },
            description: { type: String },
            image: { type: String }
          }
        ],
        
        // For 'artistry' and 'trust_banner' types
        stats: [
          {
            label: { type: String },
            value: { type: String },
            suffix: { type: String }
          }
        ],
        
        // For 'accolades' type
        accolades: [
          {
            icon: { type: String },
            title: { type: String },
            description: { type: String }
          }
        ]
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Brand', brandSchema);
