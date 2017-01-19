# Interaction between calendar_app and MarioUI

## Messages from calendar_app to MarioUI (posted on calendar topic)
Case 1: Show the home screen (calendar with upcoming events)
Use [showoptions](#showoptions)
```
{
    "action": "showcal",
    "targets": ["UI"],
    "heading": "Coming up...",
    "options": [{
        "name": "Event_name",
        "start": "Start Date & time (ISO 8601)",
        "end": "End Date & time (ISO 8601)",
        "noted": true/false,
        "action": "Action to send back to the UIEvents if selected",
        "keywords": ["keyword1", keyword2"]
    }, {
        "name": Christmas,
        "start": 2016-12-25T00:00:00+01:00,
        "end": 2016-12-25T23:59:59+01:00, 
        "noted": true,
        "action": "showevent?id=10",
        "keywords": ["Christmas"]
    }]
}
```

Case 2: Show detailed information about an event (providing the ability to note/un-note the event down)
```
{
    "action": "showevent",
    "targets": ["UI"],
    "title": "Title of the event",
    "start": "Start Date & time (ISO 8601)",
    "end": "End Date & time (ISO 8601)",
    "noted": true/false,
    "noteaction": "togglenote?id=10 or empty(if not unnotable eg. take a pill)",
    "description": "Description of the event",
    "img": "relevant image path"
}
```

Case 3: Show notifications at the time or x time before an event
```
{
    "action": "shownotification",
    "targets": ["UI"],
    "title": "Title of the event",
    "start": "Start Date & time (ISO 8601)",
    "end": "End Date & time (ISO 8601)",
    "description": "Description of the event",
    "img": "relevant image path"
}
```

##Messages from MarioUI to calendar app (Posted on UIEvents topic)
```
{
    "ability": "Name of the app"
    "action": "Action activated by the UI"
}
```
_Example_
```
{
    "ability": "calendar"
    "action": "showevent?id=10"
}
```
