# Solr

In this section, we provide guides and references to use the Apache Solr connector. You can view the full documentation for Solr <a href="https://solr.apache.org/guide/solr/latest/" target="_blank">here</a>.

## Requirements

We extract Solr's metadata by using its <a href="https://solr.apache.org/guide/solr/latest/configuration-guide/collections-api.html" target="_blank">HTTP APIs</a>. To run this ingestion, you just need a user with permissions to read the collections and their schema on the Solr instance. The same connector works for a standalone Solr and for SolrCloud — point the host at any node of the cluster.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Base URL of the Solr instance, specified as `http://hostname:port/solr`. For example, `http://localhost:8983/solr` or `https://localhost:8983/solr`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `http://host.docker.internal:8983/solr` as the value.
$$

$$section
### Username $(id="username")
Username to connect to Solr. Required only when Basic Authentication is enabled on Solr.
$$

$$section
### Password $(id="password")
Password of the user account to connect with Solr. Required only when Basic Authentication is enabled on Solr.
$$

$$section
### Verify SSL $(id="verifySSL")
Client SSL verification policy when connecting over HTTPS. Set to `validate` to verify the server certificate against a CA certificate (configure the SSL Config below), `ignore` to skip verification, or `no-ssl` when connecting over plain HTTP.
$$

$$section
### SSL Config $(id="sslConfig")
Client SSL configuration used when `Verify SSL` is set to `validate`. Provide the CA certificate used to verify the Solr server's certificate.
$$

$$section
### CA Certificate $(id="caCertificate")
The CA certificate used for SSL validation (`__root.pem`).
$$

$$section
### Connection Timeout in Seconds $(id="connectionTimeoutSecs")
The maximum time in seconds to wait when establishing a connection to the Solr instance. Defaults to 30 seconds.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the Solr instance during the connection.
$$
