---
title: Most Active Users | OpenMetadata User Activity
slug: /main-concepts/metadata-standard/schemas/datainsight/type/mostactiveusers
---

# MostActiveUsers

*pageViewsByEntities data blob*

## Properties

- **`userName`** *(string)*: Name of a user.
- **`team`** *(string)*: Team a user belongs to.
- **`lastSession`**: date time of the most recent session for the user. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`sessions`** *(number)*: Total number of sessions.
- **`sessionDuration`** *(number)*: Total duration of all sessions in seconds.
- **`avgSessionDuration`** *(number)*: avg. duration of a sessions in seconds.
- **`pageViews`** *(number)*: Total number of pages viewed by the user.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
