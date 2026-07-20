const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  country:     { type: String, required: true },
  contentType: { type: String, required: true },
  category:    { type: String },
  language:    { type: String },
  businessName:{ type: String },
  city:        { type: String },
  text:        { type: String, required: true },
  tokens:      { type: Number },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', ContentSchema);
