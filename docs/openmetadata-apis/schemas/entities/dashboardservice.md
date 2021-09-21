# Dashboard Service

This schema defines the Messaging Service entity, such as Kafka and Pulsar.

**$id: https://open-metadata.org/schema/entity/services/dashboardService.json**

Type: `object`

## Properties
 - **id** `required`
   - Unique identifier of this dashboard service instance.
   - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
   - Name that identifies this dashboard service.
   - Type: `string`
   - Length: between 1 and 64
 - **serviceType** `required`
   - Type of dashboard service such as Looker or Superset...
   - $ref: [#/definitions/dashboardServiceType](#dashboardservicetype)
 - **description**
   - Description of a dashboard service instance.
   - Type: `string`
 - **dashboardUrl** `required`
   - Dashboard Service URL. This will be used to make REST API calls to Dashboard Service.
   - Type: `string`
   - String format must be a "uri"
 - **username**
   - Username to log-into Dashboard Service.
   - Type: `string`
 - **password**
   - Password to log-into Dashboard Service.
   - Type: `string`
 - **ingestionSchedule**
   - Schedule for running metadata ingestion jobs.
   - $ref: [../../type/schedule.json](../types/schedule.md)
 - **href**
   - Link to the resource corresponding to this messaging service.
   - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)


## Type definitions in this schema
### dashboardServiceType

 - Type of Dashboard service - Superset, Looker, Redash or Tableau.
 - Type: `string`
 - The value is restricted to the following: 
   1. _"Superset"_
   2. _"Looker"_
   3. _"Tableau"_
   4. _"Redash"_



_This document was updated on: Thursday, September 16, 2021_