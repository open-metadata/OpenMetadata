/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * StorageService Metadata Pipeline Configuration.
 */
export interface StorageServiceMetadataPipeline {
    /**
     * Regex to only fetch containers that matches the pattern.
     */
    containerFilterPattern?: FilterPattern;
    /**
     * Optional configuration to toggle the tags ingestion.
     */
    includeTags?: boolean;
    /**
     * Inline manifest entries for auto-discovering data in object storage. Supports glob
     * patterns, auto-partition detection, and unstructured file cataloging. Replaces the
     * external manifest file approach.
     */
    manifest?: ManifestEntry[];
    /**
     * Optional configuration to soft delete containers in OpenMetadata if the source containers
     * are deleted. Also, if the topic is deleted, all the associated entities with that
     * containers will be deleted
     */
    markDeletedContainers?: boolean;
    /**
     * Set the 'Override Metadata' toggle to control whether to override the existing metadata
     * in the OpenMetadata server with the metadata fetched from the source. If the toggle is
     * set to true, the metadata fetched from the source will override the existing metadata in
     * the OpenMetadata server. If the toggle is set to false, the metadata fetched from the
     * source will not override the existing metadata in the OpenMetadata server. This is
     * applicable for fields like description, tags, owner and displayName
     */
    overrideMetadata?: boolean;
    /**
     * Deprecated: Use manifest instead for auto-discovery. This external manifest-based
     * approach requires manually listing each data path. It will be removed in a future release.
     */
    storageMetadataConfigSource?: StorageMetadataConfigurationSourceDeprecated;
    /**
     * Pipeline type
     */
    type?: StorageMetadataConfigType;
}

/**
 * Regex to only fetch containers that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * A manifest entry for auto-discovering structured or unstructured data in object storage.
 * Supports glob patterns, auto-partition detection, and explicit partition column
 * definitions.
 */
export interface ManifestEntry {
    /**
     * When enabled, automatically detects Hive-style partition columns from directory names
     * (e.g., year=2024/month=01/).
     */
    autoPartitionDetection?: boolean;
    /**
     * Path segments to exclude from discovery. Any file path containing these segments will be
     * skipped. Defaults to common internal paths like _delta_log, _temporary, _spark_metadata,
     * .tmp, _SUCCESS.
     */
    excludePaths?: string[];
    /**
     * Glob patterns to exclude from discovery. Any file matching these patterns will be
     * skipped. Example patterns exclude an archive subtree or a temp prefix subtree.
     */
    excludePatterns?: string[];
    /**
     * Explicit partition column definitions. Overrides auto-detection when provided. Use when
     * auto-detection cannot determine partition structure (e.g., non-standard directory naming).
     */
    partitionColumns?: PartitionColumn[];
    /**
     * Glob-style path pattern relative to bucket root. Use a single-star wildcard for one path
     * level, and a double-star wildcard for recursive matching. Example patterns: data, one
     * level wildcard, events, parquet files; or logs, recursive wildcard, json files.
     */
    pathPattern: string;
    /**
     * For delimited files such as CSV, the separator character.
     */
    separator?: string;
    /**
     * Expected file format for schema inference. Leave blank to auto-detect from the file
     * extension. Ignored when Unstructured Data is enabled.
     */
    structureFormat?: null | string;
    /**
     * When true, files matching the path pattern are cataloged as individual containers without
     * schema extraction. Use for images, documents, and other non-tabular files.
     */
    unstructuredData?: boolean;
}

export interface PartitionColumn {
    /**
     * Partition column data type.
     */
    dataType: DataType;
    /**
     * Display name for the data type (optional).
     */
    dataTypeDisplay?: string;
    /**
     * Description of the partition column (optional).
     */
    description?: string;
    /**
     * Partition column name.
     */
    name: string;
}

/**
 * Partition column data type.
 *
 * This enum defines the type of data stored in a column.
 */
export enum DataType {
    AggState = "AGG_STATE",
    Aggregatefunction = "AGGREGATEFUNCTION",
    Array = "ARRAY",
    Bigint = "BIGINT",
    Binary = "BINARY",
    Bit = "BIT",
    Bitmap = "BITMAP",
    Blob = "BLOB",
    Boolean = "BOOLEAN",
    Bytea = "BYTEA",
    Byteint = "BYTEINT",
    Bytes = "BYTES",
    CIDR = "CIDR",
    Char = "CHAR",
    Clob = "CLOB",
    Date = "DATE",
    Datetime = "DATETIME",
    Datetimerange = "DATETIMERANGE",
    Decimal = "DECIMAL",
    Double = "DOUBLE",
    Enum = "ENUM",
    Error = "ERROR",
    Fixed = "FIXED",
    Float = "FLOAT",
    Geography = "GEOGRAPHY",
    Geometry = "GEOMETRY",
    Heirarchy = "HEIRARCHY",
    Hierarchyid = "HIERARCHYID",
    Hll = "HLL",
    Hllsketch = "HLLSKETCH",
    Image = "IMAGE",
    Inet = "INET",
    Int = "INT",
    Interval = "INTERVAL",
    Ipv4 = "IPV4",
    Ipv6 = "IPV6",
    JSON = "JSON",
    Kpi = "KPI",
    Largeint = "LARGEINT",
    Long = "LONG",
    Longblob = "LONGBLOB",
    Lowcardinality = "LOWCARDINALITY",
    Macaddr = "MACADDR",
    Map = "MAP",
    Measure = "MEASURE",
    MeasureHidden = "MEASURE HIDDEN",
    MeasureVisible = "MEASURE VISIBLE",
    Mediumblob = "MEDIUMBLOB",
    Mediumtext = "MEDIUMTEXT",
    Money = "MONEY",
    Ntext = "NTEXT",
    Null = "NULL",
    Number = "NUMBER",
    Numeric = "NUMERIC",
    PGLsn = "PG_LSN",
    PGSnapshot = "PG_SNAPSHOT",
    Point = "POINT",
    Polygon = "POLYGON",
    QuantileState = "QUANTILE_STATE",
    Record = "RECORD",
    Rowid = "ROWID",
    Set = "SET",
    Smallint = "SMALLINT",
    Spatial = "SPATIAL",
    String = "STRING",
    Struct = "STRUCT",
    Super = "SUPER",
    Table = "TABLE",
    Text = "TEXT",
    Time = "TIME",
    Timestamp = "TIMESTAMP",
    Timestampz = "TIMESTAMPZ",
    Tinyint = "TINYINT",
    Tsquery = "TSQUERY",
    Tsvector = "TSVECTOR",
    Tuple = "TUPLE",
    TxidSnapshot = "TXID_SNAPSHOT",
    UUID = "UUID",
    Uint = "UINT",
    Union = "UNION",
    Unknown = "UNKNOWN",
    Varbinary = "VARBINARY",
    Varchar = "VARCHAR",
    Variant = "VARIANT",
    XML = "XML",
    Year = "YEAR",
}

/**
 * Deprecated: Use manifest instead for auto-discovery. This external manifest-based
 * approach requires manually listing each data path. It will be removed in a future
 * release.
 *
 * No manifest file available. Ingestion would look for bucket-level metadata file instead
 *
 * Storage Metadata Manifest file path config.
 *
 * Storage Metadata Manifest file HTTP path config.
 *
 * Storage Metadata Manifest file S3 path config.
 *
 * Storage Metadata Manifest file ADLS path config.
 *
 * Storage Metadata Manifest file GCS path config.
 */
export interface StorageMetadataConfigurationSourceDeprecated {
    /**
     * Storage Metadata manifest file path to extract locations to ingest from.
     */
    manifestFilePath?: string;
    /**
     * Storage Metadata manifest http file path to extract locations to ingest from.
     */
    manifestHttpPath?: string;
    prefixConfig?:     StorageMetadataBucketDetails;
    securityConfig?:   Credentials;
}

/**
 * Details of the bucket where the storage metadata manifest file is stored
 */
export interface StorageMetadataBucketDetails {
    /**
     * Name of the top level container where the storage metadata file is stored
     */
    containerName: string;
    /**
     * Path of the folder where the storage metadata file is stored. If the file is at the root,
     * you can keep it empty.
     */
    objectPrefix?: string;
}

/**
 * AWS credentials configs.
 *
 * Azure Cloud Credentials
 *
 * GCP credentials configs.
 */
export interface Credentials {
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume
     * Role
     */
    assumeRoleArn?: string;
    /**
     * An identifier for the assumed role session. Use the role session name to uniquely
     * identify a session when the same role is assumed by different principals or for different
     * reasons. Required Field in case of Assume Role
     */
    assumeRoleSessionName?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume
     * Role
     */
    assumeRoleSourceIdentity?: string;
    /**
     * AWS Access key ID.
     */
    awsAccessKeyId?: string;
    /**
     * AWS Region
     */
    awsRegion?: string;
    /**
     * AWS Secret Access Key.
     */
    awsSecretAccessKey?: string;
    /**
     * AWS Session Token.
     */
    awsSessionToken?: string;
    /**
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
    /**
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
    /**
     * Account Name of your storage account
     */
    accountName?: string;
    /**
     * Your Service Principal App ID (Client ID)
     */
    clientId?: string;
    /**
     * Your Service Principal Password (Client Secret)
     */
    clientSecret?: string;
    /**
     * Scopes to get access token, for e.g. api://6dfX33ab-XXXX-49df-XXXX-3459eX817d3e/.default
     */
    scopes?: string;
    /**
     * Tenant ID of your Azure Subscription
     */
    tenantId?: string;
    /**
     * Key Vault Name
     */
    vaultName?: string;
    /**
     * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
     * Credentials Path
     */
    gcpConfig?: GCPCredentialsConfiguration;
    /**
     * we enable the authenticated service account to impersonate another service account
     */
    gcpImpersonateServiceAccount?: GCPImpersonateServiceAccountValues;
}

/**
 * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
 * Credentials Path
 *
 * Pass the raw credential values provided by GCP
 *
 * Pass the path of file containing the GCP credentials info
 *
 * Use the application default credentials
 */
export interface GCPCredentialsConfiguration {
    /**
     * Google Cloud auth provider certificate.
     */
    authProviderX509CertUrl?: string;
    /**
     * Google Cloud auth uri.
     */
    authUri?: string;
    /**
     * Google Cloud email.
     */
    clientEmail?: string;
    /**
     * Google Cloud Client ID.
     */
    clientId?: string;
    /**
     * Google Cloud client certificate uri.
     */
    clientX509CertUrl?: string;
    /**
     * Google Cloud private key.
     */
    privateKey?: string;
    /**
     * Google Cloud private key id.
     */
    privateKeyId?: string;
    /**
     * Project ID
     *
     * GCP Project ID to parse metadata from
     */
    projectId?: string[] | string;
    /**
     * Google Cloud token uri.
     */
    tokenUri?: string;
    /**
     * Google Cloud Platform account type.
     *
     * Google Cloud Platform ADC ( Application Default Credentials )
     */
    type?: string;
    /**
     * Path of the file containing the GCP credentials info
     */
    path?: string;
    /**
     * Google Security Token Service audience which contains the resource name for the workload
     * identity pool and the provider identifier in that pool.
     */
    audience?: string;
    /**
     * This object defines the mechanism used to retrieve the external credential from the local
     * environment so that it can be exchanged for a GCP access token via the STS endpoint
     */
    credentialSource?: { [key: string]: string };
    /**
     * Google Cloud Platform account type.
     */
    externalType?: string;
    /**
     * Google Security Token Service subject token type based on the OAuth 2.0 token exchange
     * spec.
     */
    subjectTokenType?: string;
    /**
     * Google Security Token Service token exchange endpoint.
     */
    tokenURL?: string;
    [property: string]: any;
}

/**
 * we enable the authenticated service account to impersonate another service account
 *
 * Pass the values to impersonate a service account of Google Cloud
 */
export interface GCPImpersonateServiceAccountValues {
    /**
     * The impersonated service account email
     */
    impersonateServiceAccount?: string;
    /**
     * Number of seconds the delegated credential should be valid
     */
    lifetime?: number;
    [property: string]: any;
}

/**
 * Pipeline type
 *
 * Object Store Source Config Metadata Pipeline type
 */
export enum StorageMetadataConfigType {
    StorageMetadata = "StorageMetadata",
}
