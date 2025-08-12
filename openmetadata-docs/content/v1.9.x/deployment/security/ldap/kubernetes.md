---
title: Ldap Authentication for Kubernetes
slug: /deployment/security/ldap/kubernetes
collate: false
---

# LDAP Authentication for Kubernetes

This guide outlines how to configure LDAP authentication for Kubernetes deployments of OpenMetadata. It includes details on required configurations, optional settings, and best practices to ensure secure and efficient authentication.

## Authentication Configuration

```yaml 
Update the `openmetadata.yaml` file with the following settings to enable LDAP authentication:
openmetadata:
  config:
    authorizer:
     initialAdmins: ["admin"]  # Add admin users here
     principalDomain: "example.com"  # Organization domain for principal matching
    authentication:
      provider: ldap
      publicKeys:
        - "https://<your-domain>/api/v1/system/config/jwks" # Replace with your domain
      authority: "https://<your-domain>" # Replace with your domain
      enableSelfSignup: false
      
      ldapConfiguration:
        host: "ldap.example.com"  # Replace with your LDAP server hostname
        port: 636  # Use 636 for secure LDAP (LDAPS) or 389 for standard LDAP
        dnAdminPrincipal: "cn=admin,dc=example,dc=com"
        dnAdminPassword:
          secretRef: ldap-admin-secret
          secretKey: openmetadata-ldap-secret 
        userBaseDN: "ou=users,dc=example,dc=com"  # Base DN for LDAP users
        mailAttributeName: "email"  # Attribute for email in the LDAP schema
        sslEnabled: true  # Enable SSL for secure LDAP
        truststoreConfigType: "TrustAll"  # Trust store type (options: TrustAll, JVMDefault, HostName, CustomTrustStore)
        trustStoreConfig:
          trustAllConfig:
            examineValidityDates: true  # Reject certificates outside the validity window
 
    jwtTokenConfiguration:
      enabled: true  # Enable JWT tokens for secure communication
      # File Path on Airflow Container
      rsapublicKeyFilePath: "./conf/public_key.der"
      # File Path on Airflow Container
      rsaprivateKeyFilePath: "./conf/private_key.der"
```

## Mandatory Fields for LDAP Configuration
 - **provider**: Set to `ldap` for enabling LDAP authentication.
 - **publicKeys**: Provide the public key URL in the format `{http|https}://{your_domain}:{port}/api/v1/system/config/jwks`.
 - **authority**: Specify your domain (e.g., `your_domain`).
 - **enableSelfSignup**: Set to `false` for LDAP.

 ## Key LDAP Fields

 - **host**: Hostname of the LDAP server (e.g., `localhost`).
 - **port**: Port of the LDAP server (e.g., `10636`).
 - **dnAdminPrincipal**: The Distinguished Name (DN) of the admin principal (e.g., `cn=admin,dc=example,dc=com`).
 - **dnAdminPassword**: Password for the admin principal.
 - **userBaseDN**: Base DN for user lookups (e.g., `ou=people,dc=example,dc=com`).

 ## Optional Advanced Configuration

 - **maxPoolSize**: Maximum connection pool size.
 - **sslEnabled**: Set to `true` to enable SSL connections to the LDAP server.
 - **truststoreConfigType**: Determines the type of trust store to use (`CustomTrustStore`, `HostName`, `JVMDefault`, or `TrustAll`).

 ## Example: TrustStore Configurations

 ### TrustAll Configuration

 ```yaml
openmetadata:
   config:
      ...
      authentication:
         ...
         ldapConfiguration:
            ...
            truststoreConfigType: TrustAll
            trustStoreConfig:
               examineValidityDates: true
   ...
 ```

### JVMDefault Configuration

 ```yaml
 openmetadata:
   config:
      ...
      authentication:
         ...
         ldapConfiguration:
            ...
            truststoreConfigType: JVMDefault
            trustStoreConfig:
               jvmDefaultConfig:
               verifyHostname: true
   ...
 ```

 ### HostName Configuration

 ```yaml
 openmetadata:
   config:
      ...
      authentication:
         ...
         ldapConfiguration:
            ...
            truststoreConfigType: HostName
            trustStoreConfig:
               hostNameConfig:
               allowWildCards: false
               acceptableHostNames: [localhost]
   ...
 ```

### CustomTrustStore Configuration

```yaml
openmetadata:
   config:
      ...
      authentication:
         ...
         ldapConfiguration:
            ...
            trusttoreConfigType: CustomTrustStore
            trustStoreConfig:
               customTrustManagerConfig:
               trustStoreFilePath: /path/to/truststore.jks
               trustStoreFilePassword: 
                  secretRef: ""
                  secretKey: ""
               trustStoreFileFormat: JKS
               verifyHostname: true
               examineValidityDates: true
   ...
 ```

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
