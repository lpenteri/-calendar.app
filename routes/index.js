const express = require('express');
const passport = require('passport');
const Pwd = require('../models/pwd');
const router = express.Router();
const path = require('path');

var conf = require('../conf');
var db = require('mongoskin').db(conf.mongodb, { w: 0});
    db.bind('events');

router.get('/', (req, res) => {
    if(!req.user)
        res.redirect('/login');
    else {
        Pwd.find(function(err, pwds){
            if (err) return console.error(err);
            res.render('index', {pwds: pwds}); 
        });
    }
});

router.post('/', (req, res) => {
    var pwd = new Pwd({ username: req.body.username, first_name: req.body.first_name, last_name: req.body.last_name, timezone: req.user._doc.timezone });
    pwd.save(function (error) {
        if (error) {
            return console.error(error);
        }
        else {         
            console.log('New PWD succesfully added to the DB.');
            Pwd.find(function(err, pwds){
                if (err) return console.error(err);
                return res.render('index', {pwds: pwds}); 
            });
        }
    });
});

router.get('/login', (req, res) => {
    if(!req.user)
    res.render('login', { user : req.user, error : req.flash('error')});
});

router.post('/login', passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), (req, res, next) => {
    req.session.save((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

router.get('/logout', (req, res, next) => {
    req.logout();
    req.session.save((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

/* GET calendar page. */
router.get('/calendar', function(req, res) {
    if(!req.user)
        res.redirect('/login');
    else {
        res.sendFile(path.join(__dirname + '/../views/calendar.html'));
    }
});

Number.prototype.pad_left = function(base,chr){
    var  len = (String(base || 10).length - String(this).length)+1;
    return len > 0? new Array(len).join(chr || '0')+this : this;
}

router.get('/calendar/data', function(req, res){
    if(!req.user)
        res.redirect('/login');
    else {
        db.events.find({pwd: req.query.id}).toArray(function(err, data){
            // set id property for all records
            for (var i = 0; i < data.length; i++){
                data[i].id = data[i]._id;
                                
                var YYYY_start = data[i].start_date.getFullYear();
                var MM_start = (data[i].start_date.getMonth()+1).pad_left();
                var DD_start = data[i].start_date.getDate().pad_left();
                var hh_start = data[i].start_date.getHours().pad_left();
                var mm_start = data[i].start_date.getMinutes().pad_left();

                var YYYY_end = data[i].end_date.getFullYear();
                var MM_end = (data[i].end_date.getMonth()+1).pad_left();
                var DD_end = data[i].end_date.getDate().pad_left();
                var hh_end = data[i].end_date.getHours().pad_left();
                var mm_end = data[i].end_date.getMinutes().pad_left();

                data[i].start_date = YYYY_start + "-" + MM_start + "-" + DD_start + " " + hh_start + ":" + mm_start;
                data[i].end_date = YYYY_end + "-" + MM_end + "-" + DD_end + " " + hh_end + ":" + mm_end;
            }
            //output response
            res.send(data);
        });
    }
});

router.post('/calendar/data', function(req, res){
    var data = req.body;

    //get operation type
    var mode = data["!nativeeditor_status"];
    //get id of record
    var sid = data.id;
    var tid = sid;
    
    data.pwd = req.query.id;
    data.start_date = new Date(data.start_date);
    data.end_date = new Date(data.end_date);

    //remove properties which we do not want to save in DB
    delete data.id;
    delete data.gr_id;
    delete data["!nativeeditor_status"];
//    delete data.rec_pattern;
//    delete data.event_pid;

    //output confirmation response
    function update_response(err, result){
        if (err)
            mode = "error";
        else if (mode == "inserted")
            tid = data._id;

        res.setHeader("Content-Type","text/xml");
        res.send("<data><action type='"+mode+"' sid='"+sid+"' tid='"+tid+"'/></data>");
    }
    
    //run db operation
    if (mode == "updated")
        db.events.updateById( sid, data, update_response);
    else if (mode == "inserted")
        db.events.insert(data, update_response);
    else if (mode == "deleted")
        db.events.removeById( sid, update_response);
    else
        res.send("Not supported operation");
});

module.exports = router;
