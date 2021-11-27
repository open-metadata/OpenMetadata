---
description: This document describes OpenMetadata Server Configuration
---

# Configuration

```
swagger:
  resourcePackage: org.openmetadata.catalog.resources


server:
  rootPath: '/api/*'
  applicationConnectors:
    - type: http
      port: 8585
  adminConnectors:
    - type: http
      port: 8586

# Logging settings.
# https://logback.qos.ch/manual/layouts.html#conversionWord
logging:
  level: INFO
  loggers:
    org.openmetadata.catalog.common: DEBUG
    io.swagger: ERROR
  appenders:
    - type: file
      threshold: TRACE
      logFormat: "%level [%d{HH:mm:ss.SSS}] [%t] %logger{5} - %msg %n"
      currentLogFilename: ./logs/openmetadata.log
      archivedLogFilenamePattern: ./logs/openmetadata-%d{yyyy-MM-dd}-%i.log.gz
      archivedFileCount: 7
      timeZone: UTC
      maxFileSize: 50MB

database:
  # the name of the JDBC driver, mysql in our case
  driverClass: com.mysql.cj.jdbc.Driver
  # the username and password
  user: openmetadata_user
  password: openmetadata_password
  # the JDBC URL; the database is called openmetadata_db
  url: jdbc:mysql://localhost/openmetadata_db?useSSL=false&serverTimezone=UTC


elasticsearch:
  host: localhost
  port: 9200

eventHandlerConfiguration:
  eventHandlerClassNames:
    - "org.openmetadata.catalog.events.AuditEventHandler"
    - "org.openmetadata.catalog.elasticsearch.ElasticSearchEventHandler"

health:
  delayedShutdownHandlerEnabled: true
  shutdownWaitPeriod: 1s
  healthCheckUrlPaths: ["/api/v1/health-check"]
  healthChecks:
    - name: UserDatabaseCheck
      critical: true
      schedule:
        checkInterval: 2500ms
        downtimeInterval: 10s
        failureAttempts: 2
        successAttempts: 1
```

## Server Port

```
server:
  rootPath: '/api/*'
  applicationConnectors:
    - type: http
      port: 8585
  adminConnectors:
    - type: http
      port: 8586
```

By default, the OpenMetadata server runs on port 8585. It uses Jetty Server. The above config can be changed to make it run on a different port. Once you have updated the port details in config restart the server.

## Database

```
database:
  # the name of the JDBC driver, mysql in our case
  driverClass: com.mysql.cj.jdbc.Driver
  # the username and password
  user: openmetadata_user
  password: openmetadata_password
  # the JDBC URL; the database is called openmetadata_db
  url: jdbc:mysql://localhost/openmetadata_db?useSSL=false&serverTimezone=UTC
```

The above section is database connection details to MySQL database. We recommend you create a MySQL user with a strong password and update this section accordingly.

## ElasticSearch

```
elasticsearch:
  host: localhost
  port: 9200
```

ElasticSearch is one of the pre-requisites to run OpenMetadata. Default configuration expects a single instance of ElasticSearch running on the local machine. Please make sure you update it with your production elastic search.

## EventHandlers

```
eventHandlerConfiguration:
  eventHandlerClassNames:
    - "org.openmetadata.catalog.events.AuditEventHandler"
    - "org.openmetadata.catalog.elasticsearch.ElasticSearchEventHandler"
```

EventHandler configuration is optional. It will update the AuditLog in MySQL DB and also ElasticSearch indexes whenever any entity is updated either through UI or API interactions. We recommend you leave it there as it enhances the user experience.

## Healthcheck

```
health:
  delayedShutdownHandlerEnabled: true
  shutdownWaitPeriod: 1s
  healthCheckUrlPaths: ["/api/v1/health-check"]
  healthChecks:
    - name: UserDatabaseCheck
      critical: true
      schedule:
        checkInterval: 2500ms
        downtimeInterval: 10s
        failureAttempts: 2
        successAttempts: 1
```

Healthcheck API provides an API endpoint to check the OpenMetadata server health. We recommend in production settings to use this API to monitor the health of your OpenMetadata instance. Please tune the above configuration according to your production needs.

## Security

Please follow our [Enable Security Guide](https://docs.open-metadata.org/install/enable-security) guide to configure security for your OpenMetadata installation.
