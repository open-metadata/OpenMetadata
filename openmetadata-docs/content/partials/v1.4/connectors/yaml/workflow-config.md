```yaml {% srNumber=300 %}
workflowConfig:
  loggerLevel: INFO  # DEBUG, INFO, WARNING or ERROR
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
    ## Store the service Connection information
    storeServiceConnection: true  # false
    ## Secrets Manager Configuration
    # secretsManagerProvider: aws, azure or noop
    # secretsManagerLoader: airflow or env
    ## If SSL, fill the following
    # verifySSL: validate  # or ignore
    # sslConfig:
    #   certificatePath: /local/path/to/certificate
```