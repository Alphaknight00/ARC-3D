/**
 * ARC3D™ Project Model
 * Stores user CAD project data in MongoDB
 */

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: { type: String, default: '' },
    address:     { type: String, default: '' },
    contact:     { type: String, default: '' },
    type: {
        type: String,
        enum: ['residential', 'commercial', 'extension', 'renovation', 'custom'],
        default: 'residential'
    },
    tags:     [String],
    favorite: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },

    // The full project JSON (scene, objects, settings, etc.)
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    // PNG thumbnail as base64
    thumbnail: { type: String, default: '' },

    objectCount: { type: Number, default: 0 },
    size:        { type: Number, default: 0 },  // bytes

    // Track the ARC3D version that created/last saved this project
    appVersion: { type: String, default: '2.1' }
}, {
    timestamps: true   // createdAt, updatedAt
});

// Compound index for user's project list sorted by last update
projectSchema.index({ userId: 1, updatedAt: -1 });
projectSchema.index({ userId: 1, favorite: 1 });
projectSchema.index({ userId: 1, type: 1 });

/**
 * Return a summary without the heavy data/thumbnail fields
 */
projectSchema.methods.toSummary = function () {
    return {
        id:          this._id,
        name:        this.name,
        description: this.description,
        address:     this.address,
        contact:     this.contact,
        type:        this.type,
        tags:        this.tags,
        favorite:    this.favorite,
        isPublic:    this.isPublic,
        objectCount: this.objectCount,
        size:        this.size,
        appVersion:  this.appVersion,
        thumbnail:   this.thumbnail,
        createdAt:   this.createdAt,
        updatedAt:   this.updatedAt
    };
};

module.exports = mongoose.model('Project', projectSchema);
