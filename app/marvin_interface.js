#!/usr/bin/node
var http = require('http'),
    fs = require('fs');
const url = require("url"),
    querystring = require("querystring");
var CronJob = require('cron').CronJob;
var Gettext = require("node-gettext");
var gt = new Gettext();
var english_gb = fs.readFileSync("./locales/en-GB/messages.pot");
var english_ir = fs.readFileSync("./locales/en-IR/messages.pot");
var italian = fs.readFileSync("./locales/it-IT/messages.pot");
gt.addTextdomain("en-GB", english_gb);
gt.addTextdomain("en-IR", english_ir);
gt.addTextdomain("it-IT", italian);

var conf = require("../conf");
var eventclient  = require("./eventclient");
var mongo2calendar = require("./mongo2calendar");
const Event = require("../models/event");
const Pwd = require("../models/pwd");

/**
 * \class marvin_interface
 * \version 0.2.0
 * \date October 2016
 * \author lazaros penteridis <lp@ortelio.co.uk>
 */
function marvin_interface()
{
    this.marvin  = new eventclient(conf.marvin_ip, conf.marvin_port);
    this.cal = new mongo2calendar();
    this.topic = "calendar";
    this.subscriber = "calendar_app";
    this.resources = ["UI"];
    this.resources_topics = ["UIEvents", "UCEvents"];
    this.ui_subscribed = false;
    this.username = "leizer";
}


/**
 * \brief initialization steps the app must follow when the start message from 
 * the task manager comes register for calendar topic, create as needed
 * \param resources (optional) is an array of stings with the resources that required 
 * the app, so the app needs to subscribe to their topics.
 */
marvin_interface.prototype.init = function(resources)
{
    var self = this;

    self.marvin.get_topics(function(json)
    {
        var exists = false;
        var topics = [];
        try 
        {
            topics = JSON.parse(json);
        }
        catch (e) 
        {
            console.log('init/parse error: ' +e);
            console.log(json);
        }
        for (var i = 0; i < topics.length; i++) 
        {
            if (topics[i] === self.topic) 
            {
                exists = true;
            }
        }
        if (!exists) {
            self.marvin.new_topic(self.topic, function(ok)
            {
                if (ok) 
                {
                    console.log(self.topic + ' created successfully.');
                }
                else 
                {
                    console.log('failed to create topic: ' + self.topic + ' aborting...');
                    return;
                }
            });
        }
        else 
        {
//          throw self.topic + ' existed already.';
            console.log(self.topic + ' existed already.');
        }
    });
}

/**
 * \brief initialization steps the app must follow when the message from the task manager
 * saying that he is subscribed to the app's topic comes. The app replies with the components
 * it requires to work properly.
 * \param id Task manager subscribed message id, in order to be used as correlation id to the
 * reply message.
 */
marvin_interface.prototype.start = function(id)
{
    var self = this;

    // post message with the resources the app requires for the task manager to consume it 
    // and start them
    var json = {};
    json.correlationId = id;
    var body = {};
    body.targets = ["taskmanager"];
    body.resources = self.resources;
    json.body = JSON.stringify(body);
    self.post(json,
    function()
    {
        console.log("successfully posted: " + JSON.stringify(json));
    },
    function(error)
    {
        console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
    });

    // try to subscribe to all topics of the required resources in order to be able to use them
    if (self.resources_topics.length) 
    {
        self.marvin.get_topics(function(json) 
        { 
            for (i = 0; i < self.resources_topics.length; i++) 
            {
                self.search_n_sub(self.resources_topics[i], json);
            }
        });
    }

    // post message asking the UI for the required config parameters and wait for a reply to get these
    // parameters and to know that the UI subscribed in the app's topic
    // message format { "action" : "sendconfig",
    //                  "configs" : ["username", "locale"] }
    json = {};
    var body = {};
    body.targets = ["UI"];
    body.action = "sendconfig";
    body.configs = ["username", "locale"];
    json.body = JSON.stringify(body);
    self.post(json,
    function()
    {
        console.log("successfully posted: " + JSON.stringify(json));
    },
    function(error)
    {
        console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
    });
    var interval = setInterval(
        function()
        { 
            if(self.ui_subscribed === true) {
                clearInterval(interval);
                return;
            }
            self.post(json,
                function()
                {
                    console.log("successfully posted: " + JSON.stringify(json));
                },
                function(error)
                {
                    console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                }
            );
        },
        1000
    );      
}


/**
 * \brief initialization steps the app must follow when the message from the task manager asking it to stop comes.
 *        The app unsubscribes from all topics except taskmanager, posts a message that it stopped and deletes
 *        its topic.
 * \param id Task manager subscribed message id, in order to be used as correlation id to the reply message.
 */
marvin_interface.prototype.stop = function(id)
{
    var self = this;
    if (self.resources_topics.length) 
    {
        for (i = 0; i < self.resources_topics.length; i++) 
        {
            var current_topic;
            self.marvin.unsubscribe(current_topic=self.resources_topics[i], self.subscriber, function(ok)
            {
                if (ok) 
                {
                    console.log(self.subscriber + ' successfully unsubscribed from topic ' + current_topic);
                }
                else 
                {
                    throw self.subscriber + ' failed to unsubscribe from topic: ' + current_topic;
                }
            });
        }
    }

    var json = {};
    json.correlationId = id;
    var body = {};
//    body.targets = ["taskmanager"];
    body.state = "stopped";
    json.body = JSON.stringify(body);
    self.post(json,
    function()
    {
        console.log("successfully posted: " + JSON.stringify(json));
        // The message that the app stopped was sent successfully, so now we can delete the topic
        self.marvin.del_topic(self.topic, function(ok)
        {
            if (ok) 
            {
                console.log(self.topic + ' deleted successfully.');
                self.ui_subscribed = false;
            }
            else 
            {
                throw 'failed to delete topic: ' + self.topic + ' aborting...';
            }
        });
    },
    function(error)
    {
        console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
    });
}


/// \brief publish a message to the topic of the app after ensuring its existence
/// \param json the json object to be passed to eventclient.publish in order to be posted
marvin_interface.prototype.post = function(json, on_success, on_failure)
{
    var self = this;
    self.marvin.get_topics(function(topics_json)
    {
        var exists = false;
        var topics = [];
        try 
        {
            topics = JSON.parse(topics_json);
        }
        catch (e) 
        {
            console.log('init/parse error: ' +e);
            console.log(topics_json);
        }
        for (var i = 0; i < topics.length; i++) 
        {
            if (topics[i] === self.topic) 
            {
                exists = true;
            }
        }
        if (exists) {
            self.marvin.publish(self.topic, json, on_success, on_failure);
        }
        else
        {
            throw self.topic + " no longer exists.";
        }
    });
}


/**
 * \brief process a new message and pass it to the appropriate function depending on who sent it
 */
marvin_interface.prototype.msg_proc = function(message, topic)
{
    var self = this;
    // split the message into an array using the newline(s)
    var list = message.split("\n\n").filter(function(el){return el.length !== 0;});
    // get the last message from the marvin queue
    var last = list[list.length - 1];
    // remove the first 6 characters (`data =`)
    message = last.substring(6);
    var data = null;

    // parse message
    try {
        var data = JSON.parse(message);
    }
    catch (e) {
        console.log('parse error: ' + e);
        console.log(message);
    }
    if (topic === "taskmanager")
    {
        self.tm_msg(data);
    }
    else if (topic === "UIEvents" || topic === "UCEvents")
    {
        self.ui_msg(data);
    }
}


/**
 * \brief process and take proper action concerning messages from the taskmanager topic
 * \param data the data property of the message.
 */
marvin_interface.prototype.tm_msg = function(data)
{
    var self = this;

    if (data.hasOwnProperty("messageId"))
    {
        var msg_id = data.messageId;
    }
    
    if (data.hasOwnProperty("body")) 
    {
        var body = JSON.parse(data.body);
        if (body.hasOwnProperty("ability") && (body.ability === self.topic)) {
            if (body.hasOwnProperty("command"))
            {
                if ((body.command === "start") && !body.hasOwnProperty("resources"))
                {
                    self.init();
                }
                else if ((body.command === "start") && body.hasOwnProperty("resources"))
                {
                    self.init(body.resources);
                }
                else if (body.command === "stop")
                {
                    self.stop(msg_id);
                }    
            }
            else if (body.hasOwnProperty("state"))
            {
                if (body.state === "subscribed")
                {
                    self.start(msg_id);
                }
                else if (body.state !== "running")
                {
                    console.log("Wrong message format. Unknown state.");
                }
            }
            else
            {
                console.log("Wrong message format. No command or state.");
            }
        }
    }
    else 
    {
        console.log('Wrong message format. No `body` found.');
    }
}


/**
 * \brief process and take proper action concerning messages from the UIEvents topic
 * \param data the data property of the message.
 */
marvin_interface.prototype.ui_msg = function(data)
{
    var self = this;
    if (data.hasOwnProperty("body")) 
    {
        var body = JSON.parse(data.body);

        // check JSON format and members 
//        if (body.hasOwnProperty("event") && body.hasOwnProperty("ability") && (body.ability === self.topic))
        if (body.hasOwnProperty("ability") && (body.ability === this.topic))
        {
//            if (body.event === "touch" || body.event === "speak")
//            {
                if (body.hasOwnProperty("action"))
                {
                    var self = this;
                    var act_url = url.parse(body.action);
                    var action = act_url.pathname;
                    var act_params = querystring.parse(act_url.query);
                    if (action === "homescreen")
                    {
                        var json ={};
                        var body = {};
                        body.targets = ["UI"];
                        body.action = "showoptions";
                        body.heading = gt.dgettext(this.locale, "What would you like me to remind you about?");
                        var options = [];
                            
                        var temp = {};
                        temp.name = gt.dgettext(this.locale, "Today's schedule");
                        temp.img = "/_img/mario/today_schedule.png";
                        temp.action = "todayschedule";
                        temp.keywords = gt.dgettext(this.locale, "today_schedule_keywords").split(', ');
                        options.push(temp);

                        temp = {};
                        temp.name = gt.dgettext(this.locale, "Upcoming events");
                        temp.img = "/_img/mario/upcoming_events.jpg";
                        temp.action = "upcomingevents";
                        temp.keywords = gt.dgettext(this.locale, "upcoming_events_keywords").split(', ');
                        options.push(temp);

                        body.options = options;
                        json.body = JSON.stringify(body);

                        this.post(json,
                        function()
                        {
                            console.log("successfully posted: " + JSON.stringify(json));
                        },
                        function(error)
                        {
                            console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                        });
                    }
                    else if (action === "todayschedule")
                    {
                        this.pwd_id.then(function(id){
                            self.cal.get_today_events(id, function(events){
                                var json ={};
                                var body = {};
                                body.targets = ["UI"];
                                body.action = "showagenda";
                                body.heading = gt.dgettext(this.locale, "Today's schedule");
                                var options = [];
                                for (var i=0; i<events.length; i++){
                                    var temp = {};
                                    temp.name = gt.dgettext(this.locale, events[i].text);
                                    temp.start = events[i].start_date;
                                    temp.end = events[i].end_date;
                                    if ((events[i].time_unit !== "") && (events[i].notification !== ""))
                                        temp.noted = "true";
                                    else
                                        temp.noted = "false";
                                    temp.action = "showevent?id=" + events[i].id;
                                    options.push(temp);
                                }
                                body.events = options;
                                json.body = JSON.stringify(body);

                                self.post(json, function()
                                {
                                    console.log("successfully posted: " + JSON.stringify(json));
                                },
                                function(error)
                                {
                                    console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                                });
                            });
                        })
                        .catch(function(err){console.error(err);});
                    }
                    else if (action === "upcomingevents")
                    {
                        this.pwd_id.then(function(id){
                            self.cal.get_month_events(id, function(events){
                                var json ={};
                                var body = {};
                                body.targets = ["UI"];
                                body.action = "showagenda";
                                body.heading = gt.dgettext(this.locale, "Coming soon");
                                var options = [];
                                for (var i=0; i<events.length; i++){
                                    var temp = {};
                                    temp.name = gt.dgettext(this.locale, events[i].text);
                                    temp.start = events[i].start_date;
                                    temp.end = events[i].end_date;
                                    if ((events[i].time_unit !== "") && (events[i].notification !== ""))
                                        temp.noted = "true";
                                    else
                                        temp.noted = "false";
                                    temp.action = "showevent?id=" + events[i].id;
                                    options.push(temp);
                                }
                                body.events = options;
                                json.body = JSON.stringify(body);

                                self.post(json, function()
                                {
                                    console.log("successfully posted: " + JSON.stringify(json));
                                },
                                function(error)
                                {
                                    console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                                });
                            });
                        })
                        .catch(function(err){console.error(err);});
                    }
                    else if (action === "showevent")
                    {
                        Event.findById(act_params.id, function(err, event){ 
                            if (err) return console.error(err);
                            var json ={};
                            var body = {};
                            body.action = "showevent";
                            body.targets = ["UI"];
                            body.title = (this.locale ,event.text);
                            body.start = event.start_date;
                            body.end = event.end_date;
                            if ((event.time_unit !== "") && (event.notification !== ""))
                                body.noted = "true";
                            else
                                body.noted = "false";
//                            body.noteaction = "togglenote?id=" + act_params.id;
                            body.description = event.description;
//                            body.img = event.img;
                            json.body = JSON.stringify(body);

                            self.post(json, function()
                            {
                                console.log("successfully posted: " + JSON.stringify(json));
                            },
                            function(error)
                            {
                                console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                            });
                        });
                    }
                    else if (action === "togglenote")
                    {
                        Event.findById(act_params.id, function(err, event){ 
                            if (err) return console.error(err);
                            var json ={};
                            var body = {};
                            body.action = "showevent";
                            body.targets = ["UI"];
                            body.title = (this.locale ,event.text);
                            body.start = event.start_date;
                            body.end = event.end_date;
//                            body.noted = event.noted;
//                            body.noteaction = "togglenote?id=" + act_params.id;
                            body.description = event.description;
//                            body.img = event.img;
                            json.body = JSON.stringify(body);

                            self.post(json, function()
                            {
                                console.log("successfully posted: " + JSON.stringify(json));
                            },
                            function(error)
                            {
                                console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                            });
                        });
                    }
                }         
/*                }
                else
                {
                    console.log("Wrong message format. Action property missing.");
                }
            } */
//            else if (body.event === "config")
            if (body.event === "config")
            {
                var self = this;
                this.ui_subscribed = true;
                if (body.hasOwnProperty("locale"))
                {
                    this.locale = body.locale;
                }
                if (body.hasOwnProperty("username"))
                {
                    this.username = body.username;
                    this.pwd_id = new Promise(function(fulfill, reject) 
                    {
                        Pwd.findOne({"username": self.username}, "_id", function(err, pwd) 
                        {
                            if (err) 
                                reject(err);
                            else 
                                fulfill(pwd._id);
                        });
                    });
                    Pwd.findOne({"username": self.username}, "timezone", function(err, pwd) 
                    {
                        if (err) 
                            console.log("Failed to retrieve the user's timezone from the database. Error: " + err);
                        else { 
                            // will run every day at 12:00 AM
                            var job = new CronJob('0 0 0 * * *', function() 
                            {
                                self.pwd_id.then(function(id){
                                    self.cal.get_today_events(id, function(events){
                                        self.schedule_notifications(events, timezone);
                                    });
                                })
                                .catch(function(err){console.error(err);});
                            }, null, true, pwd.timezone);
                        }
                    });
                }
                var json ={};
                var body = {};
                body.targets = ["UI"];
                body.action = "showoptions";
                body.heading = gt.dgettext(this.locale, "What would you like me to remind you about?");
                var options = [];
                    
                var temp = {};
                temp.name = gt.dgettext(this.locale, "Today's schedule");
                temp.img = "/_img/mario/today_schedule.png";
                temp.action = "todayschedule";
                temp.keywords = gt.dgettext(this.locale, "today_schedule_keywords").split(', ');
                options.push(temp);

                temp = {};
                temp.name = gt.dgettext(this.locale, "Upcoming events");
                temp.img = "/_img/mario/upcoming_events.jpg";
                temp.action = "upcomingevents";
                temp.keywords = gt.dgettext(this.locale, "upcoming_events_keywords").split(', ');
                options.push(temp);

                body.options = options;
                json.body = JSON.stringify(body);

                this.post(json,
                    function(){
                        console.log("successfully posted: " + JSON.stringify(json));
                    },
                    function(error){
                        console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
                });
            }
/*            else if (body.event !== "subscribed")
            {
                console.log("Wrong message format. Unknown event.");
            } */
        }
    }
    else 
    {
        console.log('Wrong message format. No `body` found.');
    }
}


/**
 * \brief unsubscribe self from topic
 * \note may happen on termination or crash or exception
 *       where a subscriber using the `calendar_app` name exists. 
 */
marvin_interface.prototype.unsub_resub = function(topic)
{
    var self = this;

    self.marvin.get_subscribers(topic, function(json) {
        var exists = false;
        var subs = [];
        try
        {
            subs = JSON.parse(json);
        }
        catch (e) {
            console.log('unsub_resub/parse error: ' + e);
            console.log(json);
        }
        for (var i = 0; i < subs.length; i++) {
            if (subs[i] === self.subscriber)
            {
                exists = true;
            }
        }
        if (exists) {
            console.log('subscriber ' + self.subscriber + ' to topic ' + topic + ' exists, removing...');
            self.marvin.unsubscribe(topic, self.subscriber, function(){
                console.log('subscriber ' + self.subscriber + ' to topic ' + topic + ' removed, re-subscribing');
                self.marvin.subscribe(topic, self.subscriber, function(message){
                    self.msg_proc(message, topic);
                });
            });
        }
        else
        {
            console.log('subscriber ' + self.subscriber + ' to topic ' + topic + ' does not exist, subscribing');
            self.marvin.subscribe(topic, self.subscriber, function(message){
                self.msg_proc(message, topic);
            });
        }
    });
}


/**
 * \brief search for a topic until it's created and then subscribe to it.
 * \param topic the topic to be searched.
 * \param json array with the topics, in which we are searching.
 */
marvin_interface.prototype.search_n_sub = function(topic, json)
{
    var self = this;
    var topics = [];
    var exists = false;
    try {
        topics = JSON.parse(json);
    }
    catch (e) {
        console.log('init/parse error: ' +e);
        console.log(json);
    }
    for (var i = 0; i < topics.length; i++) 
    {
        if (topics[i] === topic) 
        {
            exists = true;
        }
    }
    // topic exists - (re)subscribe and process messages
    if (exists) {
        console.log('topic: ' + topic + ' exists, will try to subscribe');
        self.unsub_resub(topic);
    }
    // get the topics again until topic is found
    else {
        console.log('topic ' + topic + ' not found. Will try again in 0.5 seconds...');
        setTimeout(function() { 
            self.marvin.get_topics(function(json) { 
                self.search_n_sub(topic, json);
            }); 
        }, 500);
    }
}


/**
 * \brief send the showmodal message to marvin in order for the other components
 * to show notification for the event
 */
marvin_interface.prototype.notify = function(event)         
{
    var json = {};
    var body = {};
    body.targets = ["UI","taskmanager"];
    body.action = "showmodal";
    body.heading = event.text;
    body.text = event.description;
    body.start = event.start_date;
    body.end = event.end_date;
    body.buttons = [{
        "name": "OK, thanks",
        "context": gt.dgettext(this.locale, "positive"),
        "action": "",
        "keywords": gt.dgettext(this.locale, ["OK", "thanks"])
    }];
    json.body = JSON.stringify(body);

    this.post(json, function()
    {
        console.log("successfully posted: " + JSON.stringify(json));
    },
    function(error)
    {
        console.log("post failed: " + JSON.stringify(json) + "\nerror code: " + error);
    });
}

/**
 * \function schedule the notifications (cron jobs)
 * \param events are the events for which we want to schedule the notifications
 */
marvin_interface.prototype.schedule_notifications = function(events, timezone)
{
    var self = this;
    for (var i=0; i<events.length; i++) {
        var notify = function(i, events) {
          self.notify(events[i]);
        }
   
        if (events[i].time_unit === "hours"){
            var notification_time = new Date(events[i].start_date.getTime() - 1000*60*60*Number(events[i].notification));
        }
        else if (events[i].time_unit === "minutes"){
            var notification_time = new Date(events[i].start_date.getTime() - 1000*60*Number(events[i].notification));
        }
        if (notification_time) {
            new CronJob(notification_time, notify.bind(null, i, events), null, true, timezone);
        }
    }
}


/**
 * \brief subscribe to taskmanager topic and run the cron job that
 * checks for notifications
 */
marvin_interface.prototype.run = function()
{
    var self = this;
    self.marvin.get_topics(function(json) { 
        self.search_n_sub("taskmanager", json);
    });
}

/// exports
module.exports = marvin_interface;
