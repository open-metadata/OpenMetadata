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

import { ModifiedDBTConfigurationSource } from 'components/AddIngestion/addIngestion.interface';
import {
  DbtConfigCloud,
  DbtConfigHttp,
  DbtConfigLocal,
  DbtSourceTypes,
} from 'components/common/DBTConfigFormBuilder/DBTConfigForm.interface';
import {
  reqDBTCloudFields,
  reqDBTHttpFields,
  reqDBTLocalFields,
} from 'components/common/DBTConfigFormBuilder/DBTFormConstants';
import {
  DBT_SOURCES,
  GCS_CONFIG,
} from 'components/common/DBTConfigFormBuilder/DBTFormEnum';
import { isEmpty, isNil, isString } from 'lodash';

export const getSourceTypeFromConfig = (
  data?: ModifiedDBTConfigurationSource,
  defaultSource = DBT_SOURCES.local
): DbtSourceTypes => {
  let sourceType = defaultSource;
  let gcsType = undefined;
  if (data) {
    if (!isNil(data.dbtSecurityConfig)) {
      if (!isNil(data.dbtSecurityConfig.gcpConfig)) {
        sourceType = DBT_SOURCES.gcs;
        gcsType = isString(data.dbtSecurityConfig.gcpConfig)
          ? GCS_CONFIG.GCSCredentialsPath
          : GCS_CONFIG.GCSValues;
      }
      if (
        !isNil(data.dbtSecurityConfig.clientId) ||
        !isNil(data.dbtSecurityConfig.tenantId)
      ) {
        sourceType = DBT_SOURCES.azure;
      } else {
        sourceType = DBT_SOURCES.s3;
      }
    } else if (
      Object.keys(reqDBTHttpFields).filter(
        (field) => !isEmpty(data[field as keyof DbtConfigHttp])
      ).length > 0
    ) {
      sourceType = DBT_SOURCES.http;
    } else if (
      Object.keys(reqDBTLocalFields).filter(
        (field) => !isEmpty(data[field as keyof DbtConfigLocal])
      ).length > 0
    ) {
      sourceType = DBT_SOURCES.local;
    } else if (
      Object.keys(reqDBTCloudFields).filter(
        (field) => !isEmpty(data[field as keyof DbtConfigCloud])
      ).length > 0
    ) {
      sourceType = DBT_SOURCES.cloud;
    }
  }

  return { sourceType, gcsType };
};
