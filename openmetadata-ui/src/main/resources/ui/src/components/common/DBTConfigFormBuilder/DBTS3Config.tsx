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

import React, { Fragment, FunctionComponent, useState } from 'react';
import {
  DbtConfigSource,
  SCredentials,
} from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import {
  checkDbtS3CredsConfigRules,
  validateDbtS3Config,
} from '../../../utils/DBTConfigFormUtil';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
import {
  DbtConfigS3GCS,
  DBTFormCommonProps,
  ErrorDbtS3,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigS3GCS {
  handleSecurityConfigChange: (value: SCredentials) => void;
}

export const DBTS3Config: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleSecurityConfigChange,
}: Props) => {
  const updateS3Creds = (key: keyof SCredentials, val: string) => {
    const updatedCreds: SCredentials = {
      ...dbtSecurityConfig,
      [key]: val,
    };
    delete updatedCreds.gcsConfig;
    handleSecurityConfigChange(updatedCreds);
  };

  const [errors, setErrors] = useState<ErrorDbtS3>();
  const validate = (data: DbtConfigSource) => {
    const { isValid, errors: reqErrors } = validateDbtS3Config(
      data.dbtSecurityConfig || {}
    );
    const { isValid: fieldValid, errors: fieldErr } =
      checkDbtS3CredsConfigRules(data.dbtSecurityConfig || {});

    setErrors({ ...reqErrors, ...fieldErr });

    return isValid && fieldValid;
  };

  const handleSubmit = () => {
    const submitData = { dbtSecurityConfig };
    if (validate(submitData)) {
      onSubmit(submitData);
    }
  };

  return (
    <Fragment>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="aws-access-key-id">
          {requiredField('AWS Access Key ID')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Access Key ID.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="aws-access-key-id"
          id="aws-access-key-id"
          name="aws-access-key-id"
          type="text"
          value={dbtSecurityConfig?.awsAccessKeyId}
          onChange={(e) => updateS3Creds('awsAccessKeyId', e.target.value)}
        />
        {errors?.awsAccessKeyId && errorMsg(errors.awsAccessKeyId)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="aws-secret-access-key-id">
          {requiredField('AWS Secret Access Key')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Secret Access Key.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="aws-secret-access-key-id"
          id="aws-secret-access-key-id"
          name="aws-secret-access-key-id"
          type="password"
          value={dbtSecurityConfig?.awsSecretAccessKey}
          onChange={(e) => updateS3Creds('awsSecretAccessKey', e.target.value)}
        />
        {errors?.awsSecretAccessKey && errorMsg(errors.awsSecretAccessKey)}
      </Field>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="aws-region">
          {requiredField('AWS Region')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Region.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="aws-region"
          id="aws-region"
          name="aws-region"
          type="text"
          value={dbtSecurityConfig?.awsRegion}
          onChange={(e) => updateS3Creds('awsRegion', e.target.value)}
        />
        {errors?.awsRegion && errorMsg(errors.awsRegion)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="aws-session-token">
          AWS Session Token
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Session Token.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="aws-session-token"
          id="aws-session-token"
          name="aws-session-token"
          type="text"
          value={dbtSecurityConfig?.awsSessionToken}
          onChange={(e) => updateS3Creds('awsSessionToken', e.target.value)}
        />
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="endpoint-url">
          Endpoint URL
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          EndPoint URL for the AWS.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="endpoint-url"
          id="endpoint-url"
          name="endpoint-url"
          type="text"
          value={dbtSecurityConfig?.endPointURL}
          onChange={(e) => updateS3Creds('endPointURL', e.target.value)}
        />
        {errors?.endPointURL && errorMsg(errors.endPointURL)}
      </Field>
      {getSeparator('')}

      <Field className="tw-flex tw-justify-end">
        <Button
          className="tw-mr-2"
          data-testid="back-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onCancel}>
          <span>{cancelText}</span>
        </Button>

        <Button
          data-testid="submit-btn"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={handleSubmit}>
          <span>{okText}</span>
        </Button>
      </Field>
    </Fragment>
  );
};
