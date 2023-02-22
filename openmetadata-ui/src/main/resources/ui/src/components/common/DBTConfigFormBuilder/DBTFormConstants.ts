/*
 *  Copyright 2022 Collate.
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

import i18n from 'utils/i18next/LocalUtil';
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
    label: i18n.t('label.local-config-source'),
    value: DBT_SOURCES.local,
  },
  {
    label: i18n.t('label.http-config-source'),
    value: DBT_SOURCES.http,
  },
  {
    label: i18n.t('label.cloud-config-source'),
    value: DBT_SOURCES.cloud,
  },
  {
    label: i18n.t('label.s3-config-source'),
    value: DBT_SOURCES.s3,
  },
  {
    label: i18n.t('label.gcs-config-source'),
    value: DBT_SOURCES.gcs,
  },
];

export const GCSCreds: Array<DropDownListItem> = [
  {
    label: i18n.t('label.gcs-credential-value'),
    value: GCS_CONFIG.GCSValues,
  },
  {
    label: i18n.t('label.gcs-credential-path'),
    value: GCS_CONFIG.GCSCredentialsPath,
  },
];

export const reqDBTCloudFields: Record<keyof DbtConfigCloudReq, string> = {
  dbtCloudAccountId: 'dbt Cloud Account Id',
  dbtCloudAuthToken: 'dbt Cloud Authentication Token',
};

export const reqDBTLocalFields: Record<string, string> = {
  dbtManifestFilePath: 'dbt Manifest File Path',
};

export const reqDBTHttpFields: Record<string, string> = {
  dbtManifestHttpPath: 'dbt Manifest Http Path',
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
