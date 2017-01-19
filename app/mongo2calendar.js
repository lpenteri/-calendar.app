#!/usr/bin/node
const sugar = require("sugar");
var CronJob = require('cron').CronJob;

const Event = require("../models/event");
const Pwd = require("../models/pwd");


/**
 * \class mongo2calendar
 * \version 0.1.0
 * \date November 2016
 * \author lazaros penteridis <lp@ortelio.co.uk>
 */
function mongo2calendar()
{

}
/// \brief splicer that leaves untouched only the events of a specific day
mongo2calendar.prototype.splice_day = function(events, today)
{
    var i = events.length;
    // We iterate in reverse due to the fact that values may be removed from events array during loop execution
    while(i--)
    {    
        if (events[i].rec_type !== ""){
            var rec_split = events[i].rec_type.split("#")[0].split('_');
            if (rec_split[0] == "day"){
                var days_diff = Math.floor((today - events[i].start_date)/ (1000*60*60*24));
                if ((days_diff % rec_split[1]) !== 0){
                    events.splice(i,1);
                }
            }
            else if (rec_split[0] == "week"){
                var weeks_diff = Math.floor((today - events[i].start_date)/ (1000*60*60*24*7));
                if (((weeks_diff % rec_split[1]) !== 0) || (rec_split[4].split(',').indexOf(today.getDay().toString()) <= -1))
                    events.splice(i,1);
            }
            else if (rec_split[0] == "month"){
                var months_diff = today.getMonth() - events[i].start_date.getMonth();
                if (
                        (today.getDate() !== events[i].start_date.getDate() && (rec_split[2] === "")) ||
                        ((months_diff % rec_split[1]) !== 0) ||
                        ((rec_split[2] != today.getDay()) && (rec_split[2] != "")) || 
                        ((rec_split[3] != today.getWeekOfMonth()) && (rec_split[3] != ""))
                   )
                    events.splice(i,1);
            }
            else if (rec_split[0] == "year"){
                if (
                        (
                            (
                                (events[i].start_date.getMonth() !== today.getMonth()) || 
                                (events[i].start_date.getDate() !== 1)
                            ) &&
                            (
                                (events[i].start_date.getMonth() !== today.getMonth()-1) || 
                                ((events[i].start_date.getDate() !== 30) && (events[i].start_date.getDate() !== 31))
                            ) && 
                            (rec_split[2] != "")
                        ) ||
                        (events[i].start_date.getDate() !== today.getDate() && (rec_split[2] === "")) ||
                        (events[i].start_date.getMonth() !== today.getMonth() && (rec_split[2] === "")) ||
                        ((rec_split[2] != today.getDay()) && (rec_split[2] != "")) || 
                        ((rec_split[3] != today.getWeekOfMonth()) && (rec_split[3] != ""))
                   )
                    events.splice(i,1);
            }
        }
    }
    return events;
}


/// \brief splicer that splices all but the events of the next month
mongo2calendar.prototype.splice_month = function(events, today, next_month)
{
    var weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var i = events.length;
    // We iterate in reverse due to the fact that values may be removed from events array during loop execution
    while(i--)
    {    
        if (events[i].rec_type !== ""){
            var rec_split = events[i].rec_type.split("#")[0].split('_');
            if (rec_split[0] == "month"){
                var months_diff = today.getMonth() - events[i].start_date.getMonth();
                
                if ((months_diff % rec_split[1]) === 0){
                    if (rec_split[2] !== ""){ 
                        var event_instance = sugar.Date.create('the ' + 
                                rec_split[3] + ' ' + weekdays[rec_split[2]] +  
                                ' of ' + today.toLocaleString("en-us", { month: "long" }));
                        events[i].start_date.setFullYear(event_instance.getFullYear());
                        events[i].start_date.setMonth(event_instance.getMonth());
                        events[i].start_date.setDate(event_instance.getDate());
                    }
                    else {
                        events[i].start_date.setFullYear(today.getFullYear());
                        events[i].start_date.setMonth(today.getMonth());
                    }
                }
                else if (((months_diff + 1) % rec_split[1]) === 0){
                    if (rec_split[2] !== ""){
                        var event_instance = sugar.Date.create('the ' + 
                                rec_split[3] + ' ' + weekdays[rec_split[2]] +  ' of ' 
                                + next_month.toLocaleString("en-us", { month: "long" }));
                        events[i].start_date.setFullYear(event_instance.getFullYear());
                        events[i].start_date.setMonth(event_instance.getMonth());
                        events[i].start_date.setDate(event_instance.getDate());
                    }
                    else {
                        events[i].start_date.setFullYear(today.getFullYear());
                        events[i].start_date.setMonth(next_month.getMonth());
                    }
                }
                if (
                        (rec_split[1] != 1) &&
                        (
                            ((today.getDate() > events[i].start_date.getDate()) && ((months_diff % rec_split[1]) === 0) && (rec_split[2] === "")) ||
                            ((today.getDate() < events[i].start_date.getDate()) && (((months_diff + 1) % rec_split[1]) === 0) && (rec_split[2] === "")) ||
                            (((months_diff % rec_split[1]) !== 0) && (((months_diff + 1) % rec_split[1]) !== 0)) ||
                            (((months_diff % rec_split[1]) === 0) && (event_instance < today) && (rec_split[2] !== "")) ||
                            ((((months_diff + 1) % rec_split[1]) === 0) && (event_instance > next_month) && (rec_split[2] !== ""))
                        )
                   )
                    events.splice(i,1);
            }
            else if (rec_split[0] == "year"){
                if (rec_split[2] === "") {
                    events[i].start_date.setFullYear(today.getFullYear());
                }
                else {
                    var sugar_beet = 'the ' + rec_split[3] + ' ' + weekdays[rec_split[2]] +  ' of ';
                    if (events[i].start_date.getDate() == 1)
                        sugar_beet += events[i].start_date.toLocaleString("en-us", { month: "long" });
                    else if  ((events[i].start_date.getDate() == 30) || (events[i].start_date.getDate() == 31)) {
                        var temp_date = new Date(events[i].start_date.setMonth(start_date.getMonth()+1));
                        sugar_beet += temp_date.toLocaleString("en-us", { month: "long" });
                    }
                    var event_instance = sugar.Date.create(sugar_beet);       
                    events[i].start_date.setFullYear(event_instance.getFullYear());
                    events[i].start_date.setMonth(event_instance.getMonth());
                    events[i].start_date.setDate(event_instance.getDate());
                }
                if ((events[i].start_date > next_month) || (events[i].start_date < today))
                    events.splice(i,1);
            }
        }
    }
    return events;
}


Date.prototype.getWeekOfMonth = function(exact) {
    var month = this.getMonth()
        , year = this.getFullYear()
        , firstWeekday = new Date(year, month, 1).getDay()
        , lastDateOfMonth = new Date(year, month + 1, 0).getDate()
        , offsetDate = this.getDate() + firstWeekday - 1
        , index = 1 // start index at 0 or 1, your choice
        , weeksInMonth = index + Math.ceil((lastDateOfMonth + firstWeekday - 7) / 7)
        , week = index + Math.floor(offsetDate / 7)
        ;
    if (exact || week < 2 + index) return week;
    return week === weeksInMonth ? index + 5 : week;
};


/**
 * @function set_today_date
 * @description set the start and end dates of instances of the repetative events
 * and keep only those that are scheduled for the rest of the day
 * @param events is the array of events to be processed
 * @param now is the current data object
 */
mongo2calendar.prototype.set_today_date = function(events, now)
{ 
    var i = events.length;
    while(i--){    
        if (events[i].rec_type === "")
            continue;
        events[i].start_date.setDate(now.getDate());
        events[i].start_date.setMonth(now.getMonth());
        events[i].start_date.setFullYear(now.getFullYear());
        if (events[i].start_date < now)
            events.splice(i,1);
    }
    for (i=0; i<events.length; i++){
        if (events[i].rec_type === "")
            continue;
        events[i].end_date = new Date(events[i].start_date.getTime() + 1000*Number(events[i].event_length));
    }
    return events;
}


/**
 * @function set_this_months_date
 * @description set the start and end dates of instances of the repetative events
 * @param events is the array of events to be processed
 * @param now is the current data object
 */
mongo2calendar.prototype.set_this_months_date = function(events, now)
{
    for (i=0; i<events.length; i++){
        if (events[i].rec_type === "")
            continue;
        events[i].end_date = new Date(events[i].start_date.getTime() + 1000*Number(events[i].event_length));
    }
    return events;
}


/**
 * @function get_today_events
 * @description query the db for the events that a user has in his schedule today
 * @param id is the mongodb id of the user whose calendar is being queried
 * @param callback is the function that will receive the events
 */
mongo2calendar.prototype.get_today_events = function(id, callback)
{
    var self = this;
    var today = new Date();
    var tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
//    var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    Event.find({$or:
        [
            {"start_date": {"$gte": today, "$lt": tomorrow}, "rec_type": ""},
            {"start_date": {"$lt":tomorrow}, "end_date":{"$gt":today}, "rec_type": {"$ne":""}}
        ], "pwd": id}, 
    function(err, events){
        if (err) return console.error(err);
        events = self.splice_day(events, today);
        events = self.set_today_date(events, today);
        callback(events);
    });
}


/**
 * @function get_month_events
 * @description query the db for the events that a user has in his schedule for the next month
 * @param id is the mongodb id of the user whose calendar is being queried
 * @param callback is the function that will receive the events
 */
mongo2calendar.prototype.get_month_events = function(id, callback)
{
    var self = this;
    var today = new Date();
    var next_month = new Date(new Date(today).setMonth(today.getMonth() + 1));
    Event.find({$or:
        [
            {
                "start_date": {"$gte": today, "$lt": next_month}, 
                "rec_type": ""
            },
            {
                "start_date": {"$lt": next_month},
                "end_date":{"$gt":today},
                "rec_type": {"$nin": ["", new RegExp('^day'), new RegExp('^week')]}
            }
        ], 
        "pwd": id},
    function(err, events){
        if (err) return console.error(err);
        events = self.splice_month(events, today, next_month);
        events = self.set_this_months_date(events, today);
        callback(events);
    });
}
/// exports
module.exports = mongo2calendar;
