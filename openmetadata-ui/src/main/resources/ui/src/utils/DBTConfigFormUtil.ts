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

import { capitalize, isEmpty, isNil } from 'lodash';
import {
  ErrorDbtGCS,
  ErrorDbtHttp,
  ErrorDbtLocal,
  ErrorDbtS3,
} from '../components/common/DBTConfigFormBuilder/DBTConfigForm.interface';
import {
  reqDBTGCSCredsFields,
  reqDBTHttpFields,
  reqDBTLocalFields,
  reqDBTS3Fields,
} from '../components/common/DBTConfigFormBuilder/DBTFormConstants';
import { DBT_SOURCES } from '../components/common/DBTConfigFormBuilder/DBTFormEnum';
import {
  DbtConfigSource,
  GCSCredentialsValues,
  SCredentials,
} from '../generated/metadataIngestion/databaseServiceMetadataPipeline';
import jsonData from '../jsons/en';

export const validateDbtLocalConfig = (
  data: DbtConfigSource,
  requiredFields = reqDBTLocalFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtLocal;
  for (const field of requiredFields) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[field] = `${capitalize(field)} ${
        jsonData['form-error-messages']['is-required']
      }`;
    }
  }

  return { isValid, errors };
};

export const validateDbtHttpConfig = (
  data: DbtConfigSource,
  requiredFields = reqDBTHttpFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtHttp;
  for (const field of requiredFields) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[field] = `${capitalize(field)} ${
        jsonData['form-error-messages']['is-required']
      }`;
    }
  }

  return { isValid, errors };
};

export const validateDbtS3Config = (
  data: SCredentials,
  requiredFields = reqDBTS3Fields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtS3;
  for (const field of requiredFields) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[field] = `${capitalize(field)} ${
        jsonData['form-error-messages']['is-required']
      }`;
    }
  }

  return { isValid, errors };
};

export const validateDbtGCSCredsConfig = (
  data: GCSCredentialsValues,
  requiredFields = reqDBTGCSCredsFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtGCS;
  for (const field of requiredFields) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[field] = `${capitalize(field)} ${
        jsonData['form-error-messages']['is-required']
      }`;
    }
  }

  return { isValid, errors };
};

export const getSourceTypeFromConfig = (data: DbtConfigSource) => {
  if (!isNil(data.dbtSecurityConfig)) {
    if (!isNil(data.dbtSecurityConfig.gcsConfig)) {
      return DBT_SOURCES.gcs;
    } else {
      return DBT_SOURCES.s3;
    }
  } else if (
    reqDBTHttpFields.filter((field) => !isEmpty(data[field])).length > 0
  ) {
    return DBT_SOURCES.http;
  } else if (
    reqDBTLocalFields.filter((field) => !isEmpty(data[field])).length > 0
  ) {
    return DBT_SOURCES.local;
  } else {
    return '' as DBT_SOURCES;
  }
};
