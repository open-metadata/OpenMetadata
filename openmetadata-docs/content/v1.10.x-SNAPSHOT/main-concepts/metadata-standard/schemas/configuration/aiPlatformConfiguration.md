---
title: aiPlatformConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/aiplatformconfiguration
---

# AiPlatformConfiguration

*This schema defines the JWT Configuration.*

## Properties

- **`enabled`** *(boolean)*: Indicates whether the AI Platform is enabled. Default: `False`.
- **`host`** *(string)*: Host for the AI Platform server.
- **`port`** *(integer)*: Port for the AI Platform server.
- **`tlsCertPath`** *(string)*: Path to the TLS certificate for the AI Platform server.
- **`tlsKeyPath`** *(string)*: Path to the TLS key for the AI Platform server.
- **`trustedCertsPath`** *(string)*: Path to the trusted CA certificate for the AI Platform server.
- **`grpc`**: gRPC configuration for the AI Platform server. Refer to *#/definitions/grpcConfiguration*.
## Definitions

- **`grpcConfiguration`** *(object)*
  - **`port`** *(integer)*: Host for the gRPC server.
  - **`maxInboundMessageSize`** *(integer)*: Port for the gRPC server.
  - **`keepAliveTime`** *(integer)*: Keep alive time for the gRPC server.
  - **`keepAliveTimeout`** *(integer)*: Keep alive timeout for the gRPC server.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
