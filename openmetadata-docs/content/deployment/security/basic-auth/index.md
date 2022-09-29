---
title: Basic Authentication
slug: /deployment/security/basic-auth
---

# UserName/Password Login

Out of the box, OpenMetadata comes with a Username & Password Login Mechanism.

The default Username and Password for Login are:

```commandline
Username - admin
Password - admin
```

# Setting up Basic Auth Manually

Below are the required steps to set up the Basic Login:

## Set up Configurations in openmetadata.yaml

### Authentication Configuration

- The following configuration controls the auth mechanism for OpenMetadata. Update the mentioned fields as required.

```yaml
authenticationConfiguration:
  provider: ${AUTHENTICATION_PROVIDER:-basic}
  publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[http://localhost:8585/api/v1/config/jwks]}
  authority: ${AUTHENTICATION_AUTHORITY:-https://accounts.google.com}
  enableSelfSignup : ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-true}
```

For the Basic auth we need to set:
 
-  `provider -> basic`

-  `publicKeyUrls -> {http|https}://{your_domain}:{port}}/api/v1/config/jwks`

-  `authority -> {your_domain}`

-  `enableSelfSignup -> This flag indicates if users can come and signup by themselves on the OM`

### Authorizer Configuration

- This configuration controls the authorizer for OpenMetadata:

```yaml
authorizerConfiguration:
  adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
  allowedEmailRegistrationDomains: ${AUTHORIZER_ALLOWED_REGISTRATION_DOMAIN:-["all"]}
  principalDomain: ${AUTHORIZER_PRINCIPAL_DOMAIN:-"openmetadata.org"}
```

For the Basic auth we need to set:

- `adminPrincipals -> admin usernames to bootstrap the server with, comma-separated values`

- `allowedEmailRegistrationDomains -> This controls what all domain are allowed for email registration can be your {princialDomain} as well, for example gmail.com, outlook.comm etc.`

- `principalDomain -> This controls what all domain are allowed for email registration, for example gmail.com, outlook.comm etc.`

<Note>

Please note the following are the formats to bootstrap admins on server startup:

`[admin1,admin2,admin3]` 

- This works for SMTP-enabled servers, Login Password for these are generated randomly and sent to the mail {adminName}@{principalDomain}. If SMTP is not enabled for OpenMetadata, please use the below method to create admin users.

`[admin1:password1,admin2:password2,admin3:[password3]]` 

- This allows to bootstrap the server with given password, later on can be changed by specific users by visiting profile page.

</Note>

### Jwt Configuration

- Please note that the JWT Configuration is mandatory to work with UserName/Password Login.

```yaml
jwtTokenConfiguration:
rsapublicKeyFilePath: ${RSA_PUBLIC_KEY_FILE_PATH:-"./conf/public_key.der"}
rsaprivateKeyFilePath: ${RSA_PRIVATE_KEY_FILE_PATH:-"./conf/private_key.der"}
jwtissuer: ${JWT_ISSUER:-"open-metadata.org"}
keyId: ${JWT_KEY_ID:-"Gb389a-9f76-gdjs-a92j-0242bk94356"}
```

<Note>

By Default the jwtTokenConfiguration is shipped with OM. 

### For Local/Testing Deployment

- You can work with existing configuration as well or if you want you can generate your own private/public key.

### For Production Deployment

- It is a MUST! to update the JWT configuration. The following steps can be used.

- Generating Private/Public Keys

```commandline
openssl genrsa -out private_key.pem 2048   
openssl pkcs8 -topk8 -inform PEM -outform DER -in private_key.pem -out private_key.der -nocrypt
openssl rsa -in private_key.pem -pubout -outform DER -out public_key.der 
```

Update below with path of above generated private_key.der and public_key.der.

```yaml
rsapublicKeyFilePath: ${RSA_PUBLIC_KEY_FILE_PATH:-"./conf/public_key.der"}
rsaprivateKeyFilePath: ${RSA_PRIVATE_KEY_FILE_PATH:-"./conf/private_key.der"}
```

Jwt Issuer can be your {principalDomain}

```yaml
jwtissuer: ${JWT_ISSUER:-"open-metadata.org"}
```

KeyID is random generated UUID string, use any UUID generator to get a new KeyID.

```yaml
keyId: ${JWT_KEY_ID:-"Gb389a-9f76-gdjs-a92j-0242bk94356"}
```

</Note>

### Setting up SMTP Server

- Basic Authentication is successfully set. For a better login experience, we can also set up the SMTP server to allow the users to
  Reset Password, Account Status Updates etc. as well.

```yaml
email:
  emailingEntity: ${OM_EMAIL_ENTITY:-"OpenMetadata"} -> Company Name (Optional)
  supportUrl: ${OM_SUPPORT_URL:-"https://slack.open-metadata.org"} -> SupportUrl (Optional)
  enableSmtpServer : ${AUTHORIZER_ENABLE_SMTP:-false} -> True/False
  openMetadataUrl: ${OPENMETADATA_SERVER_URL:-""} -> {http/https}://{your_domain}
  serverEndpoint: ${SMTP_SERVER_ENDPOINT:-""} -> (Ex :- smtp.gmail.com)
  serverPort: ${SMTP_SERVER_PORT:-""} -> (SSL/TLS port)
  username: ${SMTP_SERVER_USERNAME:-""} -> (SMTP Server Username)
  password: ${SMTP_SERVER_PWD:-""} -> (SMTP Server Password)
  transportationStrategy: ${SMTP_SERVER_STRATEGY:-"SMTP_TLS"}
```
<Note>

- Following are valid value for transportation Strategy

  `SMTP      -> IF SMTP port is 25 use this`

  `SMTPS     -> IF SMTP port is 465 use this`

  `SMTP_TLS  -> IF SMTP port is 587 use this`

</Note>