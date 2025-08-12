---
title: Fix PKI Not Found When Using Keycloak with Custom PKI
description: Learn how to resolve PKI not found errors in OpenMetadata when using Keycloak behind Nginx with custom PKI by importing CA certificates into the truststore.
slug: /deployment/security/keycloak/troubleshooting
collate: false
---

# FAQ: Security with Keycloak

## How to resolve "PKI not found" error when connecting to Keycloak behind Nginx with a custom PKI?

If you're using Keycloak behind an Nginx reverse proxy with a custom Public Key Infrastructure (PKI), OpenMetadata may fail to authenticate due to missing trusted certificates. This results in a **"PKI not found"** or TLS validation error.

### Resolution

To allow OpenMetadata to trust your custom CA:

1. **Extend the OpenMetadata Docker image** and import your custom CA certificate into the Java truststore.
2. Use the following command (replace paths accordingly):

```bash
   keytool -import -trustcacerts -keystore $JAVA_HOME/lib/security/cacerts \
     -storepass changeit -noprompt -alias my-custom-ca \
     -file /path/to/your/custom-ca.crt
```

3. Alternatively, if you're using Helm, you can update your deployment by modifying the container image or using an initContainer to patch the truststore and setting:

```bash
OPENMETADATA_OPTS="-Djavax.net.ssl.trustStore=/path/to/keystore.jks \
-Djavax.net.ssl.trustStorePassword=changeit"
```

For guidance on extending the Docker image, refer to the official documentation:

[Extending OpenMetadata Docker Image (GKE Example)](/deployment/kubernetes/gke#extending-openmetadata-server-docker-image)

This enables OpenMetadata to establish a secure connection with Keycloak behind your Nginx reverse proxy using a custom certificate authority.
