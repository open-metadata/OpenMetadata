/*
 *  Copyright 2025 Collate.
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
 * DBT Catalog, Manifest and Run Results files in S3 bucket. We will search for
 * catalog.json, manifest.json and run_results.json.
 */
export interface DbtS3Config {
    /**
     * dbt Configuration type
     */
    dbtConfigType: DbtConfigType;
    /**
     * Details of the bucket where the dbt files are stored
     */
    dbtPrefixConfig?:  DBTPrefixConfig;
    dbtSecurityConfig: AWSCredentials;
}

/**
 * dbt Configuration type
 */
export enum DbtConfigType {
    S3 = "s3",
}

/**
 * Details of the bucket where the dbt files are stored
 */
export interface DBTPrefixConfig {
    /**
     * Name of the bucket where the dbt files are stored
     */
    dbtBucketName?: string;
    /**
     * Path of the folder where the dbt files are stored
     */
    dbtObjectPrefix?: string;
}

/**
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
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
}
