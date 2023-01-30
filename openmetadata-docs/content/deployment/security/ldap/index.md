---
title: Ldap Authentication
slug: /deployment/security/ldap
---

# Setting up Ldap Authentication

OpenMetadata allows using LDAP for validating email and password authentication.
Once setup successfully, the user should be able to sign in to OpenMetadata using the Ldap credentials.

Below are the required steps to set up the LDAP Authentication:

## Set up Configurations in openmetadata.yaml

### Authentication Configuration

The following configuration controls the auth mechanism for OpenMetadata. Update the mentioned fields as required.

```yaml
authenticationConfiguration:
  provider: ${AUTHENTICATION_PROVIDER:-ldap}
  publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[http://localhost:8585/api/v1/config/jwks]}
  authority: ${AUTHENTICATION_AUTHORITY:-https://accounts.google.com}
  enableSelfSignup : ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-false}
  ldapConfiguration:
    "host": ${AUTHENTICATION_LDAP_HOST:-localhost}
    "port": ${AUTHENTICATION_LDAP_PORT:-10636}
    "dnAdminPrincipal": ${AUTHENTICATION_LOOKUP_ADMIN_DN:-"cn=admin,dc=example,dc=com"}
    "dnAdminPassword": ${AUTHENTICATION_LOOKUP_ADMIN_PWD:-"secret"}
    "userBaseDN": ${AUTHENTICATION_USER_LOOKUP_BASEDN:-"ou=people,dc=example,dc=com"}
    "mailAttributeName": ${AUTHENTICATION_USER_MAIL_ATTR:-email}
    # Optional
    "maxPoolSize": ${AUTHENTICATION_LDAP_POOL_SIZE:-3}
    "sslEnabled": ${AUTHENTICATION_LDAP_SSL_ENABLED:-true}
    "keyStorePath": ${AUTHENTICATION_LDAP_KEYSTORE_PATH:-"/Users/mohityadav/sslTest/client/keystore.ks"}
    "keyStorePassword": ${AUTHENTICATION_LDAP_KEYSTORE_PWD:-"secret"}
    "truststoreFormat": ${AUTHENTICATION_LDAP_SSL_KEY_FORMAT:-"JKS"}
    "verifyCertificateHostname": ${AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST:-"false"}
```

For the LDAP auth we need to set:

OpenMetadata Specific Configuration :
 
- `provider`: ldap
- `publicKeyUrls`: {http|https}://{your_domain}:{port}}/api/v1/config/jwks
- `authority`: {your_domain}
- `enableSelfSignup`: This has to be false for Ldap.

<Note>

Mandatory LDAP Specific Configuration:

- `host`: hostName for the Ldap Server (Ex - localhost).
- `port`: port of the Ldap Server to connect to (Ex - 10636).
- `dnAdminPrincipal`: This is the DN Admin Principal(Complete path Example :- cn=admin,dc=example,dc=com ) with a lookup access in the Directory.
- `dnAdminPassword`: Above Admin Principal Password.
- `userBaseDN`: User Base DN(Complete path Example :- ou=people,dc=example,dc=com).

</Note>

Please see the below image for a sample LDAP Configuration in ApacheDS.

<Image src="/images/deployment/security/ldap/Ldap_ScreenShot1.png" alt="apache-ldap"/>

Advanced LDAP Specific Configuration (Optional):

- `maxPoolSize`: Connection Pool Size to use to connect to LDAP Server.
- `sslEnabled`: Set to true if the SSL is enable to connecto to LDAP Server.
- `keyStorePath`: Path of Keystore in case the sslEnabled is set to true.
- `keyStorePassword`: Truststore Password.
- `truststoreFormat`: TrustStore Format (Example :- JKS).
- `verifyCertificateHostname`: Controls using TrustAllSSLSocketVerifier vs HostNameSSLSocketVerifier. In case the certificate contains cn=hostname of the Ldap Server set it to true.

### Authorizer Configuration

This configuration controls the authorizer for OpenMetadata:

```yaml
authorizerConfiguration:
  adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
  principalDomain: ${AUTHORIZER_PRINCIPAL_DOMAIN:-"openmetadata.org"}
```

For the Ldap we need to set:

- `adminPrincipals`: This is the list of admin Principal for the OpenMetadata , if mail in ldap is example@openmetadata.org, then if we want this user to be admin in the OM, we should add 'example', in this list.
- `principalDomain`: Company Domain.

## Metadata Ingestion

For ingesting metadata when LDAP is enabled, it is mandatory to configure the `ingestion-bot` account with the JWT configuration. 
To know how to enable it, you can follow the documentation of [Enable JWT Tokens](/deployment/security/enable-jwt-tokens).
