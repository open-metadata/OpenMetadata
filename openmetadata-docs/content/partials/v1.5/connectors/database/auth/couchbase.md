#### Connection Details

- **Username**: Username to connect to Couchbase.
- **Password**: Password to connect to Couchbase.
- **Hostport**: If couchbase is hosted on cloud then the hostport parameter specifies the connection string and if you are using couchbase server then the hostport parameter specifies hostname of the Couchbase. This should be specified as a string in the format `hostname` or `xyz.cloud.couchbase.com`. E.g., `localhost`.
- **bucketName**: Optional name to give to the bucket in OpenMetadata. If left blank, If left blank, we will ingest all the bucket names.