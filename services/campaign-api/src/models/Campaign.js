const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    budget: { type: Number, required: true, min: 0 },
    channel: {
      type: String,
      enum: ['search', 'social', 'display', 'email', 'video', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['pending', 'classifying', 'routed', 'active', 'paused', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    classification: {
      category: String,
      priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      route: String,
      confidence: Number,
      reasoning: String,
      provider: String,
      objective: String,
      target_platform: String,
      approval_flow: String,
      workflow_steps: [String],
    },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      spend: { type: Number, default: 0 },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

campaignSchema.index({ createdAt: -1 });
campaignSchema.virtual('ctr').get(function ctr() {
  if (!this.metrics.impressions) return 0;
  return (this.metrics.clicks / this.metrics.impressions) * 100;
});

module.exports = mongoose.model('Campaign', campaignSchema);
