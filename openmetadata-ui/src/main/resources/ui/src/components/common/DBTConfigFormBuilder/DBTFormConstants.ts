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
} from './DBTConfigForm.interface';
import { DBT_SOURCES } from './DBTFormEnum';

export const DBTSources: Array<DropDownListItem> = [
  {
    name: 'None',
    value: '',
  },
  {
    name: 'DBT Local Config Source',
    value: DBT_SOURCES.local,
  },
  {
    name: 'DBT HTTP Config Source',
    value: DBT_SOURCES.http,
  },
  {
    name: 'DBT S3 Config Source',
    value: DBT_SOURCES.s3,
  },
  {
    name: 'DBT GCS Config Source',
    value: DBT_SOURCES.gcs,
  },
];

export const reqDBTLocalFields: Array<keyof DbtConfigLocal> = [
  'dbtCatalogFilePath',
  'dbtManifestFilePath',
];
export const reqDBTHttpFields: Array<keyof DbtConfigHttp> = [
  'dbtCatalogHttpPath',
  'dbtManifestHttpPath',
];
export const reqDBTS3Fields: Array<keyof DbtS3Creds> = [
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsRegion',
];
export const reqDBTGCSCredsFields: Array<keyof DbtGCSCreds> = [
  'authProviderX509CertUrl',
  'authUri',
  'clientEmail',
  'clientId',
  'clientX509CertUrl',
  'privateKey',
  'privateKeyId',
  'projectId',
  'tokenUri',
  'type',
];
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
