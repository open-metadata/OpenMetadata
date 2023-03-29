# Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.


Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV`, `Parquet` & `Avro`.


**S3 Permissions**

<p> To execute metadata extraction AWS account should have enough access to fetch required data. The <strong>Bucket Policy</strong> in AWS requires at least these permissions: </p>

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<my bucket>",
                "arn:aws:s3:::<my bucket>/*"
            ]
        }
    ]
}
```


**GCP Permissions / Roles**


<p> To execute metadata extraction GCP account should have enough access to fetch required data. The <strong>Bucket Policy</strong> requires at least these permissions: </p>

- **storage.buckets.get**
- **storage.buckets.list**
- **storage.objects.get**
- **storage.objects.list**


`storage.objects.list`: This permission is needed to list the objects in a bucket.

`storage.objects.get`: This permission is needed to read the contents of an object in a bucket.

`storage.buckets.get`: This permission is needed to get information about a bucket, such as its location and storage class.

`storage.buckets.list`: This permission is needed to list the buckets in a project.
