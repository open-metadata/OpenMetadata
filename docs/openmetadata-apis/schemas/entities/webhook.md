# ChangeEvent

This schema defines webhook for receiving events from OpenMetadata.

**$id:** [**https://open-metadata.org/schema/entity/events/webhook.json**](https://open-metadata.org/schema/entity/events/webhook.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique ID associated with a webhook subscription.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Unique name of the application receiving webhook events.
	 - Type: `string`
	 - Length: between 1 and 128
 - **description**
	 - Description of the application.
	 - Type: `string`
 - **endpoint**
	 - Endpoint to receive the webhook events over POST requests.
	 - Type: `string`
	 - String format must be a "uri"
 - **eventFilters**
	 - Endpoint to receive the webhook events over POST requests.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/changeEvent.json#/definitions/eventFilter](../types/changeevent.md#eventfilter)
 - **batchSize**
	 - Maximum number of events sent in a batch (Default 10).
	 - Type: `integer`
	 - Default: `10`
 - **timeout**
	 - Connection timeout in seconds. (Default 10s).
	 - Type: `integer`
	 - Default: `10`
 - **enabled**
	 - When set to `true`, the webhook event notification is enabled. Set it to `false` to disable the subscription. (Default `true`).
	 - Type: `boolean`
	 - Default: _true_
 - **secretKey**
	 - Secret set by the webhook client used for computing HMAC SHA256 signature of webhook payload and sent in `X-OM-Signature` header in POST requests to publish the events.
	 - Type: `string`
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **status**
	 - Status is `notStarted`, when webhook was created with `enabled` set to false and it never started publishing events. Status is `started` when webhook is normally functioning and 200 OK response was received for callback notification. Status is `failed` on bad callback URL, connection failures, `1xx`, and `3xx` response was received for callback notification. Status is `awaitingRetry` when previous attempt at callback timed out or received `4xx`, `5xx` response. Status is `retryLimitReached` after all retries fail.
	 - Type: `string`
	 - The value is restricted to the following: 
		 1. _"notStarted"_
		 2. _"started"_
		 3. _"failed"_
		 4. _"awaitingRetry"_
		 5. _"retryLimitReached"_
 - **failureDetails**
	 - Failure details are set only when `status` is not `success`.
	 - Type: `object`
	 - This schema <u>does not</u> accept additional properties.
	 - **Properties**
		 - **lastSuccessfulAt**
			 - Last non-successful callback time in UNIX UTC epoch time in milliseconds.
			 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
		 - **lastFailedAt**
			 - Last non-successful callback time in UNIX UTC epoch time in milliseconds.
			 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
		 - **lastFailedStatusCode**
			 - Last non-successful activity response code received during callback.
			 - Type: `integer`
		 - **lastFailedReason**
			 - Last non-successful activity response reason received during callback.
			 - Type: `string`
		 - **nextAttempt**
			 - Next retry will be done at this time in Unix epoch time milliseconds. Only valid is `status` is `awaitingRetry`.
			 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **href**
	 - Link to this webhook resource.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


_This document was updated on: Tuesday, January 25, 2022_