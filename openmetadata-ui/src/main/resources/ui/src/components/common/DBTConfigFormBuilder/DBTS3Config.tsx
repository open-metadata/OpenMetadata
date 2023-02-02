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

import { Button, Input } from 'antd';
import React, { Fragment, FunctionComponent, useState } from 'react';
import {
  DBTBucketDetails,
  DbtConfig,
  SCredentials,
} from '../../../generated/metadataIngestion/dbtPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import {
  checkDbtS3CredsConfigRules,
  validateDbtS3Config,
} from '../../../utils/DBTConfigFormUtil';
import { Field } from '../../Field/Field';
import DBTCommonFields from './DBTCommonFields.component';
import {
  DbtConfigS3GCS,
  DBTFormCommonProps,
  ErrorDbtS3,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigS3GCS {
  handleSecurityConfigChange: (value: SCredentials) => void;
  handlePrefixConfigChange: (value: DBTBucketDetails) => void;
  handleUpdateDescriptions: (value: boolean) => void;
  handleUpdateDBTClassification: (value: string) => void;
}

export const DBTS3Config: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtUpdateDescriptions = false,
  dbtClassificationName,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleSecurityConfigChange,
  handlePrefixConfigChange,
  handleUpdateDescriptions,
  handleUpdateDBTClassification,
}: Props) => {
  const updateS3Creds = (key: keyof SCredentials, val: string) => {
    const updatedCreds: SCredentials = {
      ...dbtSecurityConfig,
      [key]: val,
    };
    delete updatedCreds.gcsConfig;
    handleSecurityConfigChange(updatedCreds);
  };

  const updateDbtBucket = (key: keyof DBTBucketDetails, val: string) => {
    const updatedBucket: DBTBucketDetails = {
      ...dbtPrefixConfig,
      [key]: val,
    };
    handlePrefixConfigChange(updatedBucket);
  };

  const [errors, setErrors] = useState<ErrorDbtS3>();
  const validate = (data: DbtConfig) => {
    const { isValid, errors: reqErrors } = validateDbtS3Config(
      data.dbtSecurityConfig || {}
    );
    const { isValid: fieldValid, errors: fieldErr } =
      checkDbtS3CredsConfigRules(data.dbtSecurityConfig || {});

    setErrors({ ...reqErrors, ...fieldErr });

    return isValid && fieldValid;
  };

  const handleSubmit = () => {
    const submitData = {
      dbtSecurityConfig,
      dbtPrefixConfig,
      dbtUpdateDescriptions,
      dbtClassificationName,
    };
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
          AWS Access Key ID
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Access Key ID.
        </p>
        <Input.Password
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="aws-access-key-id"
          id="aws-access-key-id"
          name="aws-access-key-id"
          value={dbtSecurityConfig?.awsAccessKeyId}
          onChange={(e) => updateS3Creds('awsAccessKeyId', e.target.value)}
        />
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="aws-secret-access-key-id">
          AWS Secret Access Key
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Secret Access Key.
        </p>

        <Input.Password
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="aws-secret-access-key-id"
          id="aws-secret-access-key-id"
          name="aws-secret-access-key-id"
          value={dbtSecurityConfig?.awsSecretAccessKey}
          onChange={(e) => updateS3Creds('awsSecretAccessKey', e.target.value)}
        />
      </Field>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="aws-region">
          {requiredField('AWS Region')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          AWS Region.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
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
        <Input.Password
          className="tw-form-inputs tw-form-inputs-padding"
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
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="endpoint-url"
          id="endpoint-url"
          name="endpoint-url"
          type="text"
          value={dbtSecurityConfig?.endPointURL}
          onChange={(e) => updateS3Creds('endPointURL', e.target.value)}
        />
        {errors?.endPointURL && errorMsg(errors.endPointURL)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="dbt-bucket-name">
          dbt Bucket Name
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          Name of the bucket where the dbt files are stored.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbt-bucket-name"
          id="dbt-bucket-name"
          name="dbt-bucket-name"
          type="text"
          value={dbtPrefixConfig?.dbtBucketName}
          onChange={(e) => updateDbtBucket('dbtBucketName', e.target.value)}
        />
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="dbt-object-prefix">
          dbt Object Prefix
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          Path of the folder where the dbt files are stored.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbt-object-prefix"
          id="dbt-object-prefix"
          name="dbt-object-prefix"
          type="text"
          value={dbtPrefixConfig?.dbtObjectPrefix}
          onChange={(e) => updateDbtBucket('dbtObjectPrefix', e.target.value)}
        />
      </Field>
      {getSeparator('')}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="s3-update-description"
        handleUpdateDBTClassification={handleUpdateDBTClassification}
        handleUpdateDescriptions={handleUpdateDescriptions}
      />

      {getSeparator('')}

      <Field className="d-flex justify-end">
        <Button
          className="m-r-xs"
          data-testid="back-button"
          type="link"
          onClick={onCancel}>
          {cancelText}
        </Button>

        <Button
          className="font-medium p-x-md p-y-xxs h-auto rounded-6"
          data-testid="submit-btn"
          type="primary"
          onClick={handleSubmit}>
          {okText}
        </Button>
      </Field>
    </Fragment>
  );
};
