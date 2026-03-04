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
 * Configuration for pipeline log storage
 */
export interface LogStorageConfiguration {
    /**
     * Size of async buffer in MB for batching log writes
     */
    asyncBufferSizeMB?: number;
    /**
     * AWS credentials configuration
     */
    awsConfig?: AWSCredentials;
    /**
     * S3 bucket name for storing logs (required for S3 type)
     */
    bucketName?: string;
    /**
     * Enable it for pipelines deployed in the server
     */
    enabled?: boolean;
    /**
     * Enable server-side encryption for S3 objects
     */
    enableServerSideEncryption?: boolean;
    /**
     * Number of days after which logs are automatically deleted (0 means no expiration)
     */
    expirationDays?: number;
    /**
     * KMS Key ID for server-side encryption (if applicable)
     */
    kmsKeyId?: string;
    /**
     * Maximum number of concurrent log streams allowed
     */
    maxConcurrentStreams?: number;
    /**
     * S3 key prefix for organizing logs
     */
    prefix?: string;
    /**
     * Server-side encryption algorithm (if applicable)
     */
    sseAlgorithm?: SSEAlgorithm;
    /**
     * S3 storage class for log objects
     */
    storageClass?: StorageClass;
    /**
     * Timeout in minutes for idle log streams before automatic cleanup
     */
    streamTimeoutMinutes?: number;
    /**
     * Type of log storage implementation
     */
    type: Type;
}

/**
 * AWS credentials configuration
 *
 * AWS credentials configs.
 */
export interface AWSCredentials {
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
    awsRegion: string;
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
}

/**
 * Server-side encryption algorithm (if applicable)
 */
export enum SSEAlgorithm {
    Aes256 = "AES256",
    AwsKms = "aws:kms",
}

/**
 * S3 storage class for log objects
 */
export enum StorageClass {
    DeepArchive = "DEEP_ARCHIVE",
    Glacier = "GLACIER",
    IntelligentTiering = "INTELLIGENT_TIERING",
    OnezoneIa = "ONEZONE_IA",
    Standard = "STANDARD",
    StandardIa = "STANDARD_IA",
}

/**
 * Type of log storage implementation
 */
export enum Type {
    Default = "default",
    S3 = "s3",
}
