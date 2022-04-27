/*
 *  Copyright 2021 Collate
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

import {
  DbtConfigSource,
  GCSCredentialsValues,
  SCredentials,
} from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { DBT_SOURCES } from './DBTFormEnum';

export interface DBTFormCommonProps {
  okText: string;
  cancelText: string;
  onCancel: () => void;
  onSubmit: (data?: DbtConfigSource) => void;
}

export interface DBTConfigFormProps extends DBTFormCommonProps {
  data?: DbtConfigSource;
  source?: DBT_SOURCES;
  handleSourceChange?: (src: DBT_SOURCES) => void;
}

export type GCSCredentialsErrors = Record<keyof GCSCredentialsValues, boolean>;
type SCredentialsErrors = Record<
  keyof SCredentials,
  boolean | GCSCredentialsErrors
>;

export type DbtConfigSourceErrors = Record<
  keyof DbtConfigSource,
  boolean | SCredentialsErrors
>;

export type DbtConfigLocal = Pick<
  DbtConfigSource,
  'dbtCatalogFilePath' | 'dbtManifestFilePath'
>;

export type DbtConfigHttp = Pick<
  DbtConfigSource,
  'dbtCatalogHttpPath' | 'dbtManifestHttpPath'
>;

export type DbtConfigS3GCS = Pick<DbtConfigSource, 'dbtSecurityConfig'>;

export type DbtS3Creds = Pick<
  SCredentials,
  | 'awsAccessKeyId'
  | 'awsRegion'
  | 'awsSecretAccessKey'
  | 'awsSessionToken'
  | 'endPointURL'
>;

export type DbtGCSCreds = GCSCredentialsValues;

export type ErrorDbtLocal = Record<keyof DbtConfigLocal, string>;

export type ErrorDbtHttp = Record<keyof DbtConfigHttp, string>;

export type ErrorDbtS3 = Record<keyof DbtS3Creds, string>;

export type ErrorDbtGCS = { gcsConfig: string } & Record<
  keyof DbtGCSCreds,
  string
>;
