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
 * Airflow REST API Connection Config for connecting via REST API.
 */
export interface AirflowRESTAPIConnection {
    /**
     * Airflow REST API version.
     */
    apiVersion?: APIVersion;
    /**
     * Choose an authentication method: Basic Auth (username/password), Access Token, GCP
     * Service Account (for Cloud Composer), or AWS Credentials (for MWAA).
     */
    authConfig: AuthenticationConfiguration;
    /**
     * Service Type
     */
    type?: ServiceType;
    /**
     * Whether to verify SSL certificates when connecting to the Airflow API.
     */
    verifySSL?: boolean;
}

/**
 * Airflow REST API version.
 *
 * Airflow REST API version. Use v1 for Airflow 2.x and v2 for Airflow 3.x. Auto will detect
 * the version automatically.
 */
export enum APIVersion {
    Auto = "auto",
    V1 = "v1",
    V2 = "v2",
}

/**
 * Choose an authentication method: Basic Auth (username/password), Access Token, GCP
 * Service Account (for Cloud Composer), or AWS Credentials (for MWAA).
 *
 * Username and password for Airflow API authentication.
 *
 * Static access token for Airflow API authentication.
 *
 * GCP credentials for Google Cloud Composer. Supports service account values, credentials
 * path, workload identity (external account), and ADC. Tokens are auto-refreshed at
 * runtime.
 *
 * AWS MWAA (Managed Workflows for Apache Airflow) authentication configuration.
 */
export interface AuthenticationConfiguration {
    /**
     * Password for basic authentication to the Airflow API.
     */
    password?: string;
    /**
     * Username for basic authentication to the Airflow API.
     */
    username?: string;
    /**
     * Static access token for Airflow API authentication.
     */
    token?: string;
    /**
     * GCP credentials configuration.
     */
    credentials?: GCPCredentials;
    /**
     * MWAA credentials and environment configuration.
     */
    mwaaConfig?: MWAAConfiguration;
}

/**
 * GCP credentials configuration.
 *
 * GCP credentials configs.
 */
export interface GCPCredentials {
    /**
     * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
     * Credentials Path
     */
    gcpConfig: GCPCredentialsConfiguration;
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
 * MWAA credentials and environment configuration.
 */
export interface MWAAConfiguration {
    /**
     * AWS credentials for generating MWAA CLI token.
     */
    awsConfig: AWSCredentials;
    /**
     * The name of your MWAA environment.
     */
    mwaaEnvironmentName: string;
}

/**
 * AWS credentials for generating MWAA CLI token.
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
 * Service Type
 */
export enum ServiceType {
    RESTAPI = "RestAPI",
}
