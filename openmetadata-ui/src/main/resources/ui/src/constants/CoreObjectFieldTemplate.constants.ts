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
export const ADVANCED_PROPERTIES = new Set([
  'connectionArguments',
  'connectionOptions',
  'sampleDataStorageConfig',
  'scheme',
  'sslConfig',
  'sslMode',
]);

export const SAMPLE_DATA_SECTION_ID_SUFFIX = '/sampleDataStorageConfig';
export const SAMPLE_DATA_CONFIG_ID_SUFFIX = '/sampleDataStorageConfig/config';
export const STORAGE_CONFIG_ID_SUFFIX =
  '/sampleDataStorageConfig/config/storageConfig';
export const AWS_S3_STORAGE_CONFIG_TITLE = 'AWS S3 Storage Config';
export const SAMPLE_DATA_PROPERTY_ORDER = [
  'bucketName',
  'prefix',
  'filePathPattern',
  'overwriteData',
  'storageConfig',
];
export const STORAGE_CONFIG_PROPERTY_ORDER = [
  'enabled',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsRegion',
  'awsSessionToken',
  'endPointURL',
  'profileName',
  'assumeRoleArn',
  'assumeRoleSessionName',
  'assumeRoleSourceIdentity',
];
export const GATED_CREDENTIAL_PROPERTY_ORDER = [
  'enabled',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsRegion',
];
export const GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER = [
  'awsSessionToken',
  'endPointURL',
  'profileName',
  'assumeRoleArn',
  'assumeRoleSessionName',
  'assumeRoleSourceIdentity',
];
export const CREDENTIAL_VALUE_PROPERTY_ORDER = [
  'projectId',
  'privateKeyId',
  'clientEmail',
  'privateKey',
  'clientId',
];
export const GATED_CREDENTIAL_VISIBLE_PROPERTIES = new Set(
  GATED_CREDENTIAL_PROPERTY_ORDER
);
export const STATIC_AWS_CREDENTIAL_PROPERTIES = new Set([
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsSessionToken',
]);
export const DEFAULT_ADVANCED_PROPERTY_NAMES = new Set([
  'authProviderX509CertUrl',
  'authUri',
  'clientX509CertUrl',
  'lifetime',
  'tokenUri',
]);
export const FULL_WIDTH_FIELD_PATTERN =
  /(url|uri|arn|path|pattern|connectionstring|jdbc|dsn|bundle|certificate|cert|pem|token|password)/i;
