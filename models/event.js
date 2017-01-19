const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Event = new Schema({
    start_date: Date,
    end_date: Date,
    text: String,
    description: String,
    rec_type: String,
    event_length: String,
    pwd: String,
    notification: String,
    time_unit: String
});

module.exports = mongoose.model('Event', Event);
