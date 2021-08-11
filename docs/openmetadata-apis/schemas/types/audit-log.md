# Audit Log

This schema defines the type for Audit Log to capture the audit trail of POST, PUT, and PATCH API operations.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/auditLog.json)

Type: `object`

## Properties

* **method** `required`
  * HTTP Method used in a call.
  * Type: `string`
  * The value is restricted to the following: 
    1. _"POST"_
    2. _"PUT"_
    3. _"PATCH"_
    4. _"DELETE"_
* **responseCode** `required`
  * HTTP response code for the api requested.
  * Type: `integer`
* **path** `required`
  * Requested API Path.
  * Type: `string`
* **userName** `required`
  * Name of the user who requested for the API.
  * Type: `string`
* **dateTime**
  * Date which the api call is made.
  * $ref: [basic.json\#/definitions/dateTime](audit-log.md#basic.jsondefinitionsdatetime)
* **entityId** `required`
  * Entity Id that was modified by the operation.
  * $ref: [basic.json\#/definitions/uuid](audit-log.md#basic.jsondefinitionsuuid)
* **entityType** `required`
  * Entity Type that modified by the operation.
  * Type: `string`

