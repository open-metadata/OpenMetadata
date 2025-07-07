### Email
To enable email alerts you will need to ensure that you have an SMTP server available. With the information for your SMTP server you can configure OpenMetadata to send email alerts either by updating the details from the UI or by updating the below section of the `operations.yaml` file. 

To update the details from the UI, navigate to Settings > Preferences > Email

{% image
src="/images/v1.8/how-to-guides/admin-guide/email.webp"
alt="Email Configuration"
caption="Email Configuration"
/%}

```
email:
  emailingEntity: ${OM_EMAIL_ENTITY:-"OpenMetadata"} -> Company Name (Optional)
  supportUrl: ${OM_SUPPORT_URL:-"https://slack.open-metadata.org"} -> SupportUrl (Optional)
  enableSmtpServer : ${AUTHORIZER_ENABLE_SMTP:-false} -> True/False
  senderMail: ${OPENMETADATA_SMTP_SENDER_MAIL}
  serverEndpoint: ${SMTP_SERVER_ENDPOINT:-""} -> (Ex :- smtp.gmail.com)
  serverPort: ${SMTP_SERVER_PORT:-""} -> (SSL/TLS port)
  username: ${SMTP_SERVER_USERNAME:-""} -> (SMTP Server Username)
  password: ${SMTP_SERVER_PWD:-""} -> (SMTP Server Password)
  transportationStrategy: ${SMTP_SERVER_STRATEGY:-"SMTP_TLS"}
```
