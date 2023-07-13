```yaml {% srNumber=99 %}
workflowConfig:
  loggerLevel: INFO  # DEBUG, INFO, WARNING or ERROR
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
    ## If SSL, fill the following
    # verifySSL: validate  # or ignore
    # sslConfig:
    #   certificatePath: /local/path/to/certificate
```