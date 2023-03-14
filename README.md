# Level Sense HomeBridge plugin

## Introduction

This plugin is meant to connect your LevelSense Sentry devices
to HomeBridge, so you can add them to HomeKit. I only have the 
Sentry Temperature/humidity Sensors, so that's all this plugin supports.
If you have other Level Sense devices you want supported, you'll need to 
submit a Pull Request with the code, or provide me with a device, so 
I can develop it myself.

## Configuration

Poll Interval is how often the API is hit to get data.  Unless you're on the pro plan, 
you can't send data faster than once every 2 minutes, so that's the minimum interval.
Default value is 15, which should be good for most cases.

You will need to enter the *email address* and *password* so that the app
can log into the web app and get a Session Key. If you prefer not to provide your password, 
you can log into the webapp and use Web Developer Tools in the browser to find the session Key.  
If you include the *Session Key* in the config, it will ignore the login information and 
use that session key instead. I have no idea how long these session keys last, so you may have 
to change it every day or so.