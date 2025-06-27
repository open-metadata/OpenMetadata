---
title: API Services | OpenMetadata Connector Integration Guide
slug: /connectors/api
---

# API Services

## Overview

The OpenMetadata API service facilitates metadata ingestion from RESTful APIs that expose OpenAPI (Swagger) specifications. This connector is particularly useful for integrating custom services or third-party tools that are not natively supported by OpenMetadata.

This is the supported list of connectors for API Services:

{% partial file="/v1.9/connectors/api/connectors-list.md" /%}

## Supported Features

-  Metadata Ingestion: Extracts metadata from services exposing OpenAPI JSON schemas.
-  Custom Integration: Allows integration with bespoke systems through standardized API definitions. 
-  Flexible Deployment: Supports both UI-based and CLI-based ingestion workflows.

## Use Cases

- Custom Application Integration: Ingest metadata from proprietary applications exposing OpenAPI specifications.  
- Third-Party Tools: Integrate with external tools and platforms that provide RESTful APIs.  
- Extended Metadata Management: Enhance metadata coverage by incorporating services beyond the default connectors.  

## Best Practices

- Schema Validation: Ensure the OpenAPI JSON schema is valid and accessible.  
- Authentication Management: Securely store and manage authentication tokens required for API access.  
- Regular Updates: Periodically update the OpenAPI JSON schema URL if the API definitions change.

If you have a request for a new connector, don't hesitate to reach out in [Slack](https://slack.open-metadata.org/) or
open a [feature request](https://github.com/open-metadata/OpenMetadata/issues/new/choose) in our GitHub repo.
