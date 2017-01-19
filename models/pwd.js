const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Pwd = new Schema({
    username: {type: String, unique: true},
    first_name: String,
    last_name: String,
    timezone: String
});

module.exports = mongoose.model('Pwd', Pwd);
