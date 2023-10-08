#### Workflow Configuration

{% codeInfo srNumber=99 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

**Logger Level**

You can specify the `loggerLevel` depending on your needs. If you are trying to troubleshoot an ingestion, running
  with `DEBUG` will give you far more traces for identifying issues.

**JWT Token**

JWT tokens will allow your clients to authenticate against the OpenMetadata server. 
To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in 
your JWT configuration.

**SSL Configuration**

If you have added SSL to the [OpenMetadata server](/deployment/security/enable-ssl), then you will need to handle
the certificates when running the ingestion too. You can either set `verifySSL` to `ignore`, or have it as `validate`,
which will require you to set the `sslConfig.certificatePath` with a local path where your ingestion runs that points
to the server certificate file.

Find more information on how to troubleshoot SSL issues [here](/deployment/security/enable-ssl/ssl-troubleshooting).

{% /codeInfo %}
