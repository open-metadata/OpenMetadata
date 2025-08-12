### Setting up SMTP Server

Basic Authentication is successfully set. For a better login experience, we can also set up the SMTP server to allow the 
users to Reset Password, Account Status Updates, etc. as well.

```yaml
email:
  emailingEntity: ${OM_EMAIL_ENTITY:-"OpenMetadata"} -> Company Name (Optional)
  supportUrl: ${OM_SUPPORT_URL:-"https://slack.open-metadata.org"} -> SupportUrl (Optional)
  enableSmtpServer : ${AUTHORIZER_ENABLE_SMTP:-false} -> True/False
  senderMail: ${OPENMETADATA_SMTP_SENDER_MAIL:-""} -> Sender's email
  serverEndpoint: ${SMTP_SERVER_ENDPOINT:-""} -> (Ex :- smtp.gmail.com)
  serverPort: ${SMTP_SERVER_PORT:-""} -> (SSL/TLS port)
  username: ${SMTP_SERVER_USERNAME:-""} -> (SMTP Server Username)
  password: ${SMTP_SERVER_PWD:-""} -> (SMTP Server Password)
  transportationStrategy: ${SMTP_SERVER_STRATEGY:-"SMTP_TLS"}
```

Following are valid value for transportation strategy:

- `SMTP`: If SMTP port is 25 use this
- `SMTPS`: If SMTP port is 465 use this
- `SMTP_TLS`: If SMTP port is 587 use this
