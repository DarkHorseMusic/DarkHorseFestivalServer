var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Sets up the mongoose model for a coordinate.
var CoordSchema = new Schema({
    lat: {
        type: Number,
        required: true
    },
    lon: {
        type: Number,
        required: true
    }
});

module.exports = CoordSchema;