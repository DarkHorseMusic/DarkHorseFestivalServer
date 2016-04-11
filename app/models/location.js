var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var CoordSchema = require('./coordSchema'); // Gets the mongoose schema for a coordinate.

// Sets up the mongoose model for a location.
var LocationSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    paths: {
        type: [CoordSchema],
        required: true
    },
    strokeColor: {
        type: String,
        required: false
    },
    strokeOpacity: {
        type: Number,
        required: false
    },
    strokeWeight: {
        type: Number,
        required: false
    },
    fillColor: {
        type: String,
        required: false
    },
    fillOpacity: {
        type: Number,
        required: false
    }
});

module.exports = mongoose.model('Location', LocationSchema);