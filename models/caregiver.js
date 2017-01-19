const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const Caregiver = new Schema({
    username: String,
    timezone: String,
    password: String
});

Caregiver.plugin(passportLocalMongoose);

module.exports = mongoose.model('Caregiver', Caregiver);
