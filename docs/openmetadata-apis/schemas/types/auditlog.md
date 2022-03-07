# Audit Log

This schema defines the Audit Log type to capture the audit trail of POST, PUT, and PATCH API operations.

**$id:**[**https://open-metadata.org/schema/type/auditLog.json**](https://open-metadata.org/schema/type/auditLog.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **method** `required`
	 - HTTP Method used in a call.
	 - Type: `string`
	 - The value is restricted to the following: 
		 1. _"POST"_
		 2. _"PUT"_
		 3. _"PATCH"_
		 4. _"DELETE"_
 - **responseCode** `required`
	 - HTTP response code for the api requested.
	 - Type: `integer`
 - **path** `required`
	 - Requested API Path.
	 - Type: `string`
 - **userName** `required`
	 - Name of the user who made the API request.
	 - Type: `string`
 - **entityId** `required`
	 - Identifier of entity that was modified by the operation.
	 - $ref: [basic.json#/definitions/uuid](basic.md#uuid)
 - **entityType** `required`
	 - Type of Entity that is modified by the operation.
	 - Type: `string`
 - **timestamp**
	 - Timestamp when the API call is made in Unix epoch time milliseconds in Unix epoch time milliseconds.
	 - $ref: [basic.json#/definitions/timestamp](basic.md#timestamp)


_This document was updated on: Monday, March 7, 2022_