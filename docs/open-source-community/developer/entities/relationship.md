# Relationship

## Introduction

Within OpenMetadata we have predefined relationship types. The Relationship enum captures all the relationships between entities. 

The relationship enum is described in the [entityRelationship](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityRelationship.json) json-schema.

## Relationship Types

### CONTAINS

CONTAINS relationship is a stronger relationship than HAS. The entity that contains other entities can't be deleted until all the entities that it contains are also deleted. Some examples of these relationships:

- Database --- contains --> Table
- DatabaseService --- contains --> Database
- MessagingService --- contains --> Topic
- PipelineService --- contains --> Pipeline
- DashboardService --- contains --> Charts
- DashboardService --- contains --> Dashboard
- Role --- contains --> Policy


### CREATED

User/Bot --- created ---> Thread

### REPLIED_TO

User/Bot --- repliedTo ---> Thread

### IS_ABOUT

Thread --- isAbout ---> Entity

### ADDRESSED_TO

Thread --- addressedTo ---> User/Team

### MENTIONED_IN

User, Team, Data assets --- mentionedIn ---> Thread

### TESTED_BY

Entity --- testedBy ---> Test

### USES

- {Dashboard|Pipeline|Query} --- uses ---> Table
- {User} --- uses ---> {Table|Dashboard|Query}
- {MlModel} --- uses ---> {Dashboard}


### OWNS 

{User|Team|Org} --- owns ---> {Table|Dashboard|Query}

### PARENT_OF

{Role} --- parentOf ---> {Role}

### HAS

HAS relationship is a weaker relationship compared to CONTAINS relationship. The entity that has HAS another entity can be deleted. During deletion, the HAS relationship is simply deleted. Examples of HAS relationship:


- Team --- has --> User
- User --- has ---> Role
- Table --- has ---> Location
- Database --- has ---> Location
- Dashboard --- has ---> Chart


### FOLLOWS

{User} --- follows ----> {Table, Database, Metrics...}

### JOINED_WITH

{Table.Column...} --- joinedWith ---> {Table.Column}

### UPSTREAM

Used for Lineage relationships

- {Table1} --- upstream ---> {Table2} (Table1 is used for creating Table2}
- {Pipeline} --- upstream ---> {Table2} (Pipeline creates Table2)
- {Table} --- upstream ---> {Dashboard} (Table was used to  create Dashboard)

### APPLIED_TO

Used to describe Policy relationships

Policy --- appliedTo ---> Location (Policy1 is applied to Location1)
