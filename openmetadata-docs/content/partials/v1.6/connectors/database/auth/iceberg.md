#### Connection Details

**Glue Catalog**

- [**AWS Credentials**](#aws-credentials)

**DynamoDB Catalog**
- **Table Name**: DynamoDB Table that works as the Iceberg Catalog.
- [**AWS Credentials**](#aws-credentials)

**Hive Catalog**

- **Uri**: Uri to the Hive Metastore.

**For Example**: 'thrift://localhost:9083'

- [**File System**](#file-system)

**REST Catalog**

- **Uri**: Uri to the REST Catalog.

**For Example**: 'http://rest-catalog/ws'.

- **Credential (Optional)**: OAuth2 credential to be used on the authentication flow.
    - **Client ID**: OAuth2 Client ID.
    - **Client Secret**: OAuth2 Client Secret.

- **Token (Optional)**: Bearer Token to use for the 'Authorization' header.

- **SSL (Optional)**:
    - **CA Certificate Path**: Path to the CA Bundle.
    - **Client Certificate Path**: Path to the Client Certificate.
    - **Private Key Path**: Path to the Private Key Certificate.

- **Sigv4 (Optional)**: Needed if signing requests using AWS SigV4 protocol.
    - **Signing AWS Region**: AWS Region to use when signing a request.
    - **Signing Name**: Name to use when signing a request.

- [**File System**](#file-system)

**Common**

- **Database Name (Optional)**: Custom Database Name for your Iceberg Service. If it is not set it will be 'default'.

- **Warehouse Location (Optional)**: Custom Warehouse Location. Most Catalogs already have the Warehouse Location defined properly and this shouldn't be needed. In case of a custom implementation you can pass the location here.

**For example**: 's3://my-bucket/warehouse/'

- **Ownership Property**: Table property to look for the Owner. It defaults to 'owner'.

The Owner should be the same e-mail set on the OpenMetadata user/group.

#### **File System**

- **Local**
- [**AWS Credentials**](#aws-credentials)
- [**Azure Credentials**](#azure-credentials)

#### AWS Credentials

{% partial file="/v1.6/connectors/database/aws.md" /%}

#### Azure Credentials

- **Client ID** : Client ID of the data storage account

- **Client Secret** : Client Secret of the account

- **Tenant ID** : Tenant ID under which the data storage account falls

- **Account Name** : Account Name of the data Storage