var express = require('express');
var router = express.Router();
const path = require('path');

var pwd = "leizer";
var conf = require('../conf');

var db = require('mongoskin').db(conf.mongodb, { w: 0});
    db.bind('event');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.sendFile(path.join(__dirname + '/../views/calendar.html'));
});

router.get('/data', function(req, res){
    db.event.find().toArray(function(err, data){
        // set id property for all records
        for (var i = 0; i < data.length; i++)
            data[i].id = data[i]._id;

        //output response
        res.send(data);
    });
});

router.post('/data', function(req, res){
    var data = req.body;

    //get operation type
    var mode = data["!nativeeditor_status"];
    //get id of record
    var sid = data.id;
    var tid = sid;
    
    data.pwd = pwd;
    //remove properties which we do not want to save in DB
    delete data.id;
    delete data.gr_id;
    delete data["!nativeeditor_status"];
    
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
        db.event.updateById( sid, data, update_response);
    else if (mode == "inserted")
        db.event.insert(data, update_response);
    else if (mode == "deleted")
        db.event.removeById( sid, update_response);
    else
        res.send("Not supported operation");
});

module.exports = router;
