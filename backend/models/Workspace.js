const mongoose = require('mongoose')

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true, collection: 'workspaces' },
)

module.exports = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema)
