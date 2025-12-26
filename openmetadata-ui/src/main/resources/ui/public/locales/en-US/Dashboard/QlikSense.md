# QlikSense

In this section, we provide guides and references to use the Metabase connector.

## Requirements

We will extract the metadata using the <a href="https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/introducing-engine-API.htm" target="_blank">Qlik Sense Engine JSON API</a>.

You can find further information on the Qlik Sense connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/qliksense" target="_blank">docs</a>.

## Connection Details

$$section
### Qlik Sense Base URL $(id="displayUrl")

This field refers to the base url of your Qlik Sense Portal, will be used for generating the redirect links for dashboards and charts. 

Example: `https://server.domain.com` or `https://server.domain.com/<virtual-proxy-path>`
$$

$$section
### Qlik Engine JSON API Websocket URL $(id="hostPort")

Enter the websocket url of Qlik Sense Engine JSON API. Refer to <a href="https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingStarted/connecting-to-engine-api.htm" target="_blank">this</a> document for more details about 

Example: `wss://server.domain.com:4747` or `wss://server.domain.com[/virtual proxy]`

**Note:** Notice that you have to provide the websocket url here which would begin with either `wss://` or `ws://`
$$

$$section
### Client Certificate Value $(id="clientCertificateData")

This field specifies the value of `client.pem` certificate required for authentication.


Make sure you are passing the key in a correct format. If your certificate looks like this:

```
-----BEGIN CERTIFICATE-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END CERTIFICATE-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$


$$section
### Client Key Certificate Value $(id="clientKeyCertificateData")

This field specifies the value of `client_key.pem` certificate required for authentication.


Make sure you are passing the key in a correct format. If your certificate looks like this:

```
-----BEGIN RSA PRIVATE KEY-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END RSA PRIVATE KEY-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$


$$section
### Root Certificate Value $(id="rootCertificateData")

This field specifies the value of `root.pem` certificate required for authentication.


Make sure you are passing the key in a correct format. If your certificate looks like this:

```
-----BEGIN CERTIFICATE-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END CERTIFICATE-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation.
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication.
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate.
$$

$$section
### Staging Directory Path $(id="stagingDir")

This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over. 
$$

$$section
### Client Certificate Path $(id="clientCertificate")

This field specifies the path of `client.pem` certificate required for authentication. 

Example: `/path/to/client.pem`
$$


$$section
### Client Key Certificate Path $(id="clientKeyCertificate")

This field specifies the path of `client_key.pem` certificate required for authentication. 

Example: `/path/to/client_key.pem`
$$


$$section
### Root Certificate Path $(id="rootCertificate")

This field specifies the path of `root.pem` certificate required for authentication. 

Example: `/path/to/root.pem`
$$

$$section
### User Directory $(id="userDirectory")

This field specifies the user directory of the user.
$$



$$section
### User ID $(id="userId")

This field specifies the user id of the user.
$$


$$section
### Validate Host Name $(id="validateHostName")

Enable/Disable this field to validate the host name against the provided certificates.
$$