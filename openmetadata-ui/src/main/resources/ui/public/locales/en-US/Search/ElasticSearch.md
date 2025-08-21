# ElasticSearch

In this section, we provide guides and references to use the ElasticSearch connector. You can view the full documentation for ElasticSearch <a href="https://docs.open-metadata.org/connectors/search/elasticsearch" target="_blank">here</a>.

## Requirements

We extract ElasticSearch's metadata by using its <a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html" target="_blank">API</a>. To run this ingestion, you just need a user with permissions to the ElasticSearch instance.

You can find further information on the ElasticSearch connector in the <a href="https://docs.open-metadata.org/connectors/search/elasticsearch" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the ElasticSearch instance. This should be specified as a string in the format `http://hostname:port`. For example, you might set the hostPort parameter to `http://localhost:9200` or `https://localhost:9200`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `http://host.docker.internal:9200` as the value.
$$

$$section
### Username $(id="username")
Username to connect to ElasticSearch required when Basic Authentication is enabled on ElasticSearch.
$$

$$section
### Password $(id="password")
Password of the user account to connect with ElasticSearch.
$$


$$section
### API Key $(id="apiKey")
API Key to connect to ElasticSearch required when API Key Authentication is enabled on ElasticSearch.
$$

$$section
### API Key ID $(id="apiKeyId")
Enter API Key ID In case of API Key Authentication if there is any API Key ID associated with the API Key, otherwise this field can be left blank.
$$


$$section
### SSL Certificates $(id="certificates")
If you have SSL/TLS enable on for your ElasticSearch you will need to pass the relevant SSL certificates in order to communicate with the ElasticSearch instance. You can either provide the where these certificates are stored or you can provide the direct value of these certificates.
$$

$$section
### CA Certificate Path $(id="caCertPath")
This field specifies the path of CA certificate required for authentication. 
$$

$$section
### Client Certificate Path $(id="clientCertPath")
This field specifies the path of Clint certificate required for authentication. 
$$


$$section
### Private Key Path $(id="privateKeyPath")
This field specifies the path of Clint Key/Private Key required for authentication. 
$$


$$section
### CA Certificate Value $(id="caCertValue")

This field specifies the value of CA certificate required for authentication.


Make sure you are passing the value of certificate in a correct format. If your certificate looks like this:

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

You will have to replace new lines with `\n` and the final value that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$

$$section
### Client Certificate Value $(id="clientCertValue")

This field specifies the value of client certificate required for authentication.


Make sure you are passing the value in a correct format. If your certificate looks like this:

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

You will have to replace new lines with `\n` and the final value that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$


$$section
### Private Key Value $(id="privateKeyValue")

This field specifies the value of private key required for authentication.


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
### Staging Directory Path $(id="stagingDir")

This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over. 
$$