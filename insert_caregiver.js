#!/usr/bin/env node
var conf = require("./conf.js")
var mongoose = require('mongoose');
mongoose.connect(conf.mongodb);
var Cg = require('./models/caregiver');

/*
var cg_data = {
    username: "test_cg",
    password: "mariokompai"
};

var cg = new Cg(cg_data);

cg.save(function(error, cg){
    if(error){
        return console.log(error);
    }
    else {
        return console.log("Caregiver inserted succesfully");
    }
});
*/

Cg.register(new Cg({username: "testcg", timezone: "Europe/London"}), "mario", (err, caregiver) => {
    if (err) {
        console.log('Error while inserting caregiver in the db', { error : err.message });
        process.exit(1);
    }
    else {
        console.log("Caregiver was inserted successfully");
        process.exit(0);
    }
});

