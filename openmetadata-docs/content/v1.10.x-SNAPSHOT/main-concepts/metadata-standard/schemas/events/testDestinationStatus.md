---
title: testDestinationStatus
slug: /main-concepts/metadata-standard/schemas/events/testdestinationstatus
---

# TestDestinationStatus

*Detailed status of the destination during a test operation, including HTTP response information.*

## Properties

- **`status`** *(string)*: Overall test status, indicating if the test operation succeeded or failed. Must be one of: `['Success', 'Failed']`.
- **`reason`** *(string)*: Detailed reason for failure if the test did not succeed.
- **`statusCode`** *(integer)*: HTTP status code of the response (e.g., 200 for OK, 404 for Not Found).
- **`statusInfo`** *(string)*: HTTP status reason phrase associated with the status code (e.g., 'Not Found').
- **`headers`**: HTTP headers returned in the response as a map of header names to values.
- **`entity`** *(string)*: Body of the HTTP response, if any, returned by the server.
- **`mediaType`** *(string)*: Media type of the response entity, if specified (e.g., application/json).
- **`location`** *(string)*: URL location if the response indicates a redirect or newly created resource.
- **`timestamp`**: Timestamp when the response was received, in UNIX epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
