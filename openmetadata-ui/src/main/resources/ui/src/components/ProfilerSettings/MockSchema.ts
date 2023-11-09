/*
 *  Copyright 2023 Collate.
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
export const MOCK_SCHEMA = {
  type: 'object',
  javaType: 'org.openmetadata.schema.type.DatabaseProfilerConfig',
  description: 'This schema defines the type for Database profile config.',
  properties: {
    profileSample: {
      description:
        'Percentage of data or no. of rows we want to execute the profiler and tests on',
      type: 'number',
      default: null,
      title: 'Profile Sample',
    },
    profileSampleType: {
      description: 'Type of Profile Sample (percentage or rows)',
      type: 'string',
      enum: ['PERCENTAGE', 'ROWS'],
      default: 'PERCENTAGE',
      title: 'Profile Sample Value',
    },
    sampleDataCount: {
      description: 'Number of row of sample data to be generated',
      type: 'integer',
      default: 50,
      title: 'Sample Data Rows Count',
    },
    sampleDataStorageConfig: {
      title: 'Storage Config for Sample Data',
      description: 'Storage config to store sample data',
      type: 'object',
      javaType:
        'org.openmetadata.schema.services.connections.database.SampleDataStorageConfig',
      properties: {
        bucketName: {
          title: 'Bucket Name',
          description: 'Bucket Name',
          type: 'string',
          default: '',
        },
        prefix: {
          title: 'Prefix',
          description: 'Prefix of the data source.',
          type: 'string',
          default: '',
        },
        overwriteData: {
          title: 'Overwrite Sample Data',
          description:
            'When this field enabled a single parquet file will be created to store sample data, otherwise we will create a new file per day',
          type: 'boolean',
          default: true,
        },
        storageConfig: {
          title: 'Storage Config',
          oneOf: [
            {
              title: 'AWS S3 Storage Config',
              $schema: 'http://json-schema.org/draft-07/schema#',
              description: 'AWS credentials configs.',
              type: 'object',
              javaType:
                'org.openmetadata.schema.security.credentials.AWSCredentials',
              properties: {
                awsAccessKeyId: {
                  title: 'AWS Access Key ID',
                  description: 'AWS Access key ID.',
                  type: 'string',
                },
                awsSecretAccessKey: {
                  title: 'AWS Secret Access Key',
                  description: 'AWS Secret Access Key.',
                  type: 'string',
                  format: 'password',
                },
                awsRegion: {
                  title: 'AWS Region',
                  description: 'AWS Region',
                  type: 'string',
                },
                awsSessionToken: {
                  title: 'AWS Session Token',
                  description: 'AWS Session Token.',
                  type: 'string',
                },
                endPointURL: {
                  title: 'Endpoint URL',
                  description: 'EndPoint URL for the AWS',
                  type: 'string',
                  format: 'uri',
                },
                profileName: {
                  title: 'Profile Name',
                  description:
                    'The name of a profile to use with the boto session.',
                  type: 'string',
                },
                assumeRoleArn: {
                  title: 'Role Arn for Assume Role',
                  description:
                    'The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume Role',
                  type: 'string',
                },
                assumeRoleSessionName: {
                  title: 'Role Session Name for Assume Role',
                  description:
                    // eslint-disable-next-line max-len
                    'An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons. Required Field in case of Assume Role',
                  type: 'string',
                  default: 'OpenMetadataSession',
                },
                assumeRoleSourceIdentity: {
                  title: 'Source Identity for Assume Role',
                  description:
                    'The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume Role',
                  type: 'string',
                },
              },
              additionalProperties: false,
              required: ['awsRegion'],
            },
            {
              title: 'OpenMetadata Storage',
              type: 'object',
            },
          ],
        },
      },
      additionalProperties: false,
    },
  },
};
