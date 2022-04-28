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

import { isEmpty, isNil, isString } from 'lodash';
import {
  DbtConfigHttp,
  DbtConfigLocal,
  DbtGCSCreds,
  DbtS3CredsReq,
  DbtSourceTypes,
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
  rulesDBTGCSCredsFields,
  rulesDBTS3CredsFields,
} from '../components/common/DBTConfigFormBuilder/DBTFormConstants';
import {
  DBT_SOURCES,
  GCS_CONFIG,
} from '../components/common/DBTConfigFormBuilder/DBTFormEnum';
import { FormValidationRulesType } from '../enums/form.enum';
import {
  DbtConfigSource,
  GCSCredentialsValues,
  SCredentials,
} from '../generated/metadataIngestion/databaseServiceMetadataPipeline';
import jsonData from '../jsons/en';
import { isValidEmail, isValidUrl } from './CommonUtils';

export const validateDbtLocalConfig = (
  data: DbtConfigSource,
  requiredFields = reqDBTLocalFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtLocal;
  for (const field of Object.keys(requiredFields) as Array<
    keyof DbtConfigLocal
  >) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[
        field
      ] = `${requiredFields[field]} ${jsonData['form-error-messages']['is-required']}`;
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
  for (const field of Object.keys(requiredFields) as Array<
    keyof DbtConfigHttp
  >) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[
        field
      ] = `${requiredFields[field]} ${jsonData['form-error-messages']['is-required']}`;
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
  for (const field of Object.keys(requiredFields) as Array<
    keyof DbtS3CredsReq
  >) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[
        field
      ] = `${requiredFields[field]} ${jsonData['form-error-messages']['is-required']}`;
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
  for (const field of Object.keys(requiredFields) as Array<keyof DbtGCSCreds>) {
    if (isEmpty(data[field])) {
      isValid = false;
      errors[
        field
      ] = `${requiredFields[field]} ${jsonData['form-error-messages']['is-required']}`;
    }
  }

  return { isValid, errors };
};

export const checkDbtS3CredsConfigRules = (
  data: SCredentials,
  ruleFields = rulesDBTS3CredsFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtS3;
  for (const rule in ruleFields) {
    if (rule === FormValidationRulesType.url) {
      for (const field of ruleFields[rule]) {
        if (!isValidUrl(data[field] || '')) {
          isValid = false;
          errors[field] = jsonData['form-error-messages']['invalid-url'];
        }
      }
    }
  }

  return { isValid, errors };
};

export const checkDbtGCSCredsConfigRules = (
  data: GCSCredentialsValues,
  ruleFields = rulesDBTGCSCredsFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtGCS;
  for (const rule in ruleFields) {
    switch (rule) {
      case FormValidationRulesType.email: {
        for (const field of ruleFields[rule]) {
          if (!isValidEmail(data[field] || '')) {
            isValid = false;
            errors[field] = jsonData['form-error-messages']['invalid-email'];
          }
        }

        break;
      }
      case FormValidationRulesType.url: {
        for (const field of ruleFields[rule]) {
          if (!isValidUrl(data[field] || '')) {
            isValid = false;
            errors[field] = jsonData['form-error-messages']['invalid-url'];
          }
        }

        break;
      }
      default:
        break;
    }
  }

  return { isValid, errors };
};

export const getSourceTypeFromConfig = (
  data?: DbtConfigSource
): DbtSourceTypes => {
  let sourceType = '' as DBT_SOURCES;
  let gcsType = undefined;
  if (data) {
    if (data && !isNil(data.dbtSecurityConfig)) {
      if (!isNil(data.dbtSecurityConfig.gcsConfig)) {
        sourceType = DBT_SOURCES.gcs;
        gcsType = isString(data.dbtSecurityConfig.gcsConfig)
          ? GCS_CONFIG.GCSCredentialsPath
          : GCS_CONFIG.GCSValues;
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
    }
  }

  return { sourceType, gcsType };
};
