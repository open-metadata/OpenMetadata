#### Connection Details for GCS

- **Bucket Name**: A bucket name in DataLake is a unique identifier used to organize and store data objects.
  It's similar to a folder name, but it's used for object storage rather than file storage.

- **Prefix**: The prefix of a data source in datalake refers to the first part of the data path that identifies the source or origin of the data. It's used to organize and categorize data within the datalake, and can help users easily locate and access the data they need.

**GCS Credentials**

We support two ways of authenticating to GCS:

1. Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
   1. Credentials type, e.g. `service_account`.
   2. Project ID
   3. Private Key ID
   4. Private Key
   5. Client Email
   6. Client ID
   7. Auth URI, [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
   8. Token URI, [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
   9. Authentication Provider X509 Certificate URL, [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
   10. Client X509 Certificate URL