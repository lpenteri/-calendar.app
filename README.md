# Calendar App

## Synopsis
The My Calendar/Events app is composed of two components a web and a robot app. Each one has 
its own UI and backend, although they both share the same calendar and event data, stored 
in a MongoDB database. The web app is aimed to be accessed through a laptop or a tablet 
from the caregivers, for them to input the calendar and event data of those that they care 
for, and it is the one who stores those data in the database. The robot app handles all the 
interaction with the PWD. It is the one that accesses the calendar and event info provided 
previously by the caregiver and either presents them to the user, upon their request or 
uses them to schedule notifications.
The My Calendar/Events application is designed to be invoked (executed) on user demand 
either via vocal commands (via speech-to-text) or by the graphical user interface (GUI) on 
the Kompai screen, or on its own, when it is time to notify/remind the pwd of some event 
that he/she or some caregiver marked as reminder worthy.

## Dependencies
Only NodeJS needs to be explicitly installed.
Then npm will take care of the rest dependencies by executing
```shell
npm install
```
in the root folder of the project.

## Usage
Before it is possible for the app to be used a caregiver account needs to be inserted in the database.
The script insert_caregiver.js shows how a caregiver with username: "testcg", password: "mario" and 
timezone: "Europe/London" is inserted. The script runs by executing
```shell
node insert_caregiver.js
```

Then the app starts by executing:
```shell
npm start
```
which starts both the web server and the robot app.

A caregiver can access the calendar web app (after they have registered themselves via executing the 
aforementioned script) in order to enter their pwds data via any web browser preferably not from the
robot, but from a tablet or a laptop that is connected in the same network.
The web address to connect to would be:
calendar_app_computer_ip:3060

The robot app, in order to behave correctly requires the other components of the Mario ecosystem 
(task manager and MarioUI) to be already running on the robot.


