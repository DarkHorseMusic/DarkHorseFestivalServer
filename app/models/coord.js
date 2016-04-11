var mongoose = require('mongoose');
var CoordSchema = require('./coordSchema'); // Gets the mongoose schema for a coordinate.

module.exports = mongoose.model('Coord', CoordSchema);