/*
 *  Copyright 2022 Collate
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
import { DbtConfigSource } from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import { validateDbtCloudConfig } from '../../../utils/DBTConfigFormUtil';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
import {
  DbtConfigCloud,
  DBTFormCommonProps,
  ErrorDbtCloud,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigCloud {
  handleCloudAccountIdChange: (value: string) => void;
  handleCloudAuthTokenChange: (value: string) => void;
}

export const DBTCloudConfig: FunctionComponent<Props> = ({
  dbtCloudAccountId = '',
  dbtCloudAuthToken = '',
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleCloudAccountIdChange,
  handleCloudAuthTokenChange,
}: Props) => {
  const [errors, setErrors] = useState<ErrorDbtCloud>();

  const validate = (data: DbtConfigSource) => {
    const { isValid, errors: reqErrors } = validateDbtCloudConfig(data);
    setErrors(reqErrors);

    return isValid;
  };

  const handleSubmit = () => {
    const submitData = { dbtCloudAccountId, dbtCloudAuthToken };
    if (validate(submitData)) {
      onSubmit(submitData);
    }
  };

  return (
    <Fragment>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="cloud-account-id">
          {requiredField('DBT Cloud Account Id')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT cloud account Id.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="cloud-account-id"
          id="cloud-account-id"
          name="cloud-account-id"
          type="text"
          value={dbtCloudAccountId}
          onChange={(e) => handleCloudAccountIdChange(e.target.value)}
        />
        {errors?.dbtCloudAccountId && errorMsg(errors.dbtCloudAccountId)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="cloud-auth-token">
          {requiredField('DBT Cloud Authentication Token')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT cloud account authentication token.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="cloud-auth-token"
          id="cloud-auth-token"
          name="cloud-auth-token"
          type="text"
          value={dbtCloudAuthToken}
          onChange={(e) => handleCloudAuthTokenChange(e.target.value)}
        />
        {errors?.dbtCloudAuthToken && errorMsg(errors.dbtCloudAuthToken)}
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
