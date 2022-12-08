# ScrimBot - A Rocket League Scrimmage Finder
_Developed by Matt Dixey (TitanHawk17)_

## Introduction & Purpose
ScrimBot was designed to find and store Rocket League scrimmages from across communities and be able to provide requested scrimmages in a fast, efficient manner. It is able to parse Discord messages that are designed to look for a scrimmage. The ultimate goal was being able to simplify the process of scouring multiple Discord communities in the hopes of finding a scrimmage. 

## How It Works
ScrimBot uses a node package to "listen" in three Rocket League Discord communities (CCA, NACE Starleague, RL 6mans NA). If the message contains the string `lfs` in any case, the message is handed off to a parse function that breaks down the message, extracting useful components about the scrimmage. The four components required for a message to be successfully stored are the MMR range, day of scrimmage, time, and timezone. Should any of these be unable to be acquired, the message is sent to a private Discord server to build a list of unrecognized scrimmage messages. Should all of the information be acquired, the scrimmage is stored in a local SQLite file that can be accessed via Discord Slash Commands. There are only two commands associated with this Discord Bot, listed in the next section of the README. 

## Commands
`/lfs [MMR_RANGE] [TIME] [TIMEZONE] [DAY]` - All four parameters are optional as they only refine the database search. `DAY` is the only non-string parameter as this is an integer greater than or equal to zero. 

`/reset` - An Admin exclusive command that allows for the scrimmage database to be reset in the event of a technical error.

## How To Use
Ensure that the commands above are deployed to each server the bot is in by running `node --experimental-json-modules deploy-commands.js`.

Then, activate the bot by running `node --experimental-json-modules index.js`.