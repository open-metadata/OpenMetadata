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

import { FormValidationRulesType } from '../../../enums/form.enum';
import { FormValidationRules } from '../../../interface/genericForm.interface';
import { DropDownListItem } from '../../dropdown/types';
import {
  DbtConfigHttp,
  DbtConfigLocal,
  DbtGCSCreds,
  DbtS3Creds,
  DbtS3CredsReq,
} from './DBTConfigForm.interface';
import { DBT_SOURCES, GCS_CONFIG } from './DBTFormEnum';

export const DBTSources: Array<DropDownListItem> = [
  {
    name: 'No Config Source',
    value: '',
  },
  {
    name: 'Local Config Source',
    value: DBT_SOURCES.local,
  },
  {
    name: 'HTTP Config Source',
    value: DBT_SOURCES.http,
  },
  {
    name: 'S3 Config Source',
    value: DBT_SOURCES.s3,
  },
  {
    name: 'GCS Config Source',
    value: DBT_SOURCES.gcs,
  },
];

export const GCSCreds: Array<DropDownListItem> = [
  {
    name: 'GCS Credentials Values',
    value: GCS_CONFIG.GCSValues,
  },
  {
    name: 'GCS Credentials Path',
    value: GCS_CONFIG.GCSCredentialsPath,
  },
];

export const reqDBTLocalFields: Record<keyof DbtConfigLocal, string> = {
  dbtCatalogFilePath: 'DBT Catalog File Path',
  dbtManifestFilePath: 'DBT Manifest File Path',
};

export const reqDBTHttpFields: Record<keyof DbtConfigHttp, string> = {
  dbtCatalogHttpPath: 'DBT Catalog Http Path',
  dbtManifestHttpPath: 'DBT Manifest Http Path',
};

export const reqDBTS3Fields: Record<keyof DbtS3CredsReq, string> = {
  awsAccessKeyId: 'AWS Access Key ID',
  awsSecretAccessKey: 'AWS Secret Access Key',
  awsRegion: 'AWS Region',
};

export const reqDBTGCSCredsFields: Record<keyof DbtGCSCreds, string> = {
  authProviderX509CertUrl: 'Authentication Provider x509 Certificate URL',
  authUri: 'Authentication URI',
  clientEmail: 'Client Email',
  clientId: 'Client ID',
  clientX509CertUrl: 'Client x509 Certificate URL',
  privateKey: 'Private Key',
  privateKeyId: 'Private Key ID',
  projectId: 'Project ID',
  tokenUri: 'Token URI',
  type: 'Credentials Type',
};

export const rulesDBTS3CredsFields: Record<
  keyof Pick<FormValidationRules, FormValidationRulesType.url>,
  Array<keyof DbtS3Creds>
> = {
  url: ['endPointURL'],
};

export const rulesDBTGCSCredsFields: Record<
  keyof Pick<
    FormValidationRules,
    FormValidationRulesType.email | FormValidationRulesType.url
  >,
  Array<keyof DbtGCSCreds>
> = {
  email: ['clientEmail'],
  url: ['authUri', 'tokenUri', 'authProviderX509CertUrl', 'clientX509CertUrl'],
};
