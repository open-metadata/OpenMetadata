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
  DbtConfigCloud,
  DbtConfigHttp,
  DbtConfigLocal,
  DbtGCSCreds,
  DbtS3CredsReq,
  DbtSourceTypes,
  ErrorDbtCloud,
  ErrorDbtGCS,
  ErrorDbtHttp,
  ErrorDbtLocal,
  ErrorDbtS3,
} from '../components/common/DBTConfigFormBuilder/DBTConfigForm.interface';
import {
  reqDBTCloudFields,
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
import { FormValidationRules } from '../interface/genericForm.interface';
import jsonData from '../jsons/en';
import { isValidEmail, isValidUrl } from './CommonUtils';

export const validateDbtCloudConfig = (
  data: DbtConfigSource,
  requiredFields = reqDBTCloudFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtCloud;
  for (const field of Object.keys(requiredFields) as Array<
    keyof DbtConfigCloud
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

function getInvalidEmailErrors<
  Type,
  Keys extends Array<keyof Type>,
  Errors extends Partial<Record<keyof Type, string>>
>(
  data: Type,
  errors: Errors,
  ruleFields: Record<
    keyof Pick<FormValidationRules, FormValidationRulesType.email>,
    Keys
  >,
  rule: FormValidationRulesType.email
) {
  let isValid = true;
  for (const field of ruleFields[rule]) {
    if (data[field] && !isValidEmail(data[field] as unknown as string)) {
      isValid = false;
      errors[field] = jsonData['form-error-messages'][
        'invalid-email'
      ] as Errors[keyof Type];
    }
  }

  return isValid;
}

function getInvalidUrlErrors<
  Type,
  Keys extends Array<keyof Type>,
  Errors extends Partial<Record<keyof Type, string>>
>(
  data: Type,
  errors: Errors,
  ruleFields: Record<
    keyof Pick<FormValidationRules, FormValidationRulesType.url>,
    Keys
  >,
  rule: FormValidationRulesType.url
) {
  let isValid = true;
  for (const field of ruleFields[rule]) {
    if (data[field] && !isValidUrl(data[field] as unknown as string)) {
      isValid = false;
      errors[field] = jsonData['form-error-messages'][
        'invalid-url'
      ] as Errors[keyof Type];
    }
  }

  return isValid;
}

export const checkDbtS3CredsConfigRules = (
  data: SCredentials,
  ruleFields = rulesDBTS3CredsFields
) => {
  let isValid = true;
  const errors = {} as ErrorDbtS3;
  for (const rule in ruleFields) {
    if (rule === FormValidationRulesType.url) {
      // Need to update `errors` object for each rule
      // even if isValid is already false
      isValid = getInvalidUrlErrors(data, errors, ruleFields, rule) && isValid;
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
        // Need to update `errors` object for each rule
        // even if isValid is already false
        isValid =
          getInvalidEmailErrors(data, errors, ruleFields, rule) && isValid;

        break;
      }
      case FormValidationRulesType.url: {
        // Need to update `errors` object for each rule
        // even if isValid is already false
        isValid =
          getInvalidUrlErrors(data, errors, ruleFields, rule) && isValid;

        break;
      }
      default:
        break;
    }
  }

  return { isValid, errors };
};

export const getSourceTypeFromConfig = (
  data?: DbtConfigSource,
  defaultSource = '' as DBT_SOURCES
): DbtSourceTypes => {
  let sourceType = defaultSource;
  let gcsType = undefined;
  if (data) {
    if (!isNil(data.dbtSecurityConfig)) {
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
