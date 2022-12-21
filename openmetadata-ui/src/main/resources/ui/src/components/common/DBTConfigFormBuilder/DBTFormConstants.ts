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
  DbtConfigCloudReq,
  DbtGCSCreds,
  DbtS3Creds,
  DbtS3CredsReq,
} from './DBTConfigForm.interface';
import { DBT_SOURCES, GCS_CONFIG } from './DBTFormEnum';

export const DBTSources: Array<DropDownListItem> = [
  {
    name: 'Local Config Source',
    value: DBT_SOURCES.local,
  },
  {
    name: 'HTTP Config Source',
    value: DBT_SOURCES.http,
  },
  {
    name: 'Cloud Config Source',
    value: DBT_SOURCES.cloud,
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

export const reqDBTCloudFields: Record<keyof DbtConfigCloudReq, string> = {
  dbtCloudAccountId: 'DBT Cloud Account Id',
  dbtCloudAuthToken: 'DBT Cloud Authentication Token',
};

export const reqDBTLocalFields: Record<string, string> = {
  dbtManifestFilePath: 'DBT Manifest File Path',
};

export const reqDBTHttpFields: Record<string, string> = {
  dbtManifestHttpPath: 'DBT Manifest Http Path',
};

export const reqDBTS3Fields: Record<keyof DbtS3CredsReq, string> = {
  awsRegion: 'AWS Region',
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
