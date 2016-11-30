var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Sets up the mongoose model for a schedule.
var ScheduleSchema = new Schema({
    id: {
        type: Number,
        unique: true,
        required: true
    },
    icon: {
        type: String,
        required: false
    },
    name: {
        type: String,
        required: true
    },
    day: {
        type: String,
        required: true
    },
    startTime: {
        type: String,
        required: true,
        default: '00:00'
    },
    endTime: {
        type: String,
        required: true,
        default: '00:00'
    },
    location: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    }
});

module.exports = mongoose.model('Schedule', ScheduleSchema);