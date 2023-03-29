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
import { t } from 'i18next';
import React, { Fragment, FunctionComponent, useState } from 'react';
import { DbtConfig } from '../../../generated/metadataIngestion/dbtPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import { validateDbtCloudConfig } from '../../../utils/DBTConfigFormUtil';
import { Field } from '../../Field/Field';
import DBTCommonFields from './DBTCommonFields.component';
import {
  DbtConfigCloud,
  DBTFormCommonProps,
  ErrorDbtCloud,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigCloud {
  handleCloudAccountIdChange: (value: string) => void;
  handleCloudAuthTokenChange: (value: string) => void;
  handleUpdateDescriptions: (value: boolean) => void;
  handleDbtCloudProjectId: (value: string) => void;
  handleDbtCloudJobId: (value: string) => void;
  handleUpdateDBTClassification: (value: string) => void;
  handleDbtCloudUrl: (value: string) => void;
  enableDebugLog: boolean;
  handleEnableDebugLogCheck: (value: boolean) => void;
  handleIncludeTagsClick: (value: boolean) => void;
}

export const DBTCloudConfig: FunctionComponent<Props> = ({
  dbtCloudAccountId = '',
  dbtCloudAuthToken = '',
  dbtCloudProjectId,
  dbtCloudJobId,
  dbtUpdateDescriptions = false,
  includeTags = true,
  dbtCloudUrl = 'https://cloud.getdbt.com/',
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleCloudAccountIdChange,
  handleCloudAuthTokenChange,
  handleUpdateDescriptions,
  handleDbtCloudProjectId,
  handleDbtCloudJobId,
  dbtClassificationName,
  handleDbtCloudUrl,
  handleUpdateDBTClassification,
  enableDebugLog,
  handleEnableDebugLogCheck,
  handleIncludeTagsClick,
}: Props) => {
  const [errors, setErrors] = useState<ErrorDbtCloud>();

  const validate = (data: DbtConfig) => {
    const { isValid, errors: reqErrors } = validateDbtCloudConfig(data);
    setErrors(reqErrors);

    return isValid;
  };

  const handleSubmit = () => {
    const submitData = {
      dbtCloudAccountId,
      dbtCloudAuthToken,
      dbtUpdateDescriptions,
      dbtCloudProjectId,
      dbtClassificationName,
      dbtCloudUrl,
      dbtCloudJobId,
      includeTags,
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
          htmlFor="cloud-account-id">
          {requiredField(t('label.dbt-cloud-account-id'))}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('label.dbt-cloud-account-id')}
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
          {requiredField(t('label.dbt-cloud-account-auth-token'))}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('label.dbt-cloud-account-auth-token')}
        </p>
        <Input.Password
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="cloud-auth-token"
          id="cloud-auth-token"
          name="cloud-auth-token"
          value={dbtCloudAuthToken}
          onChange={(e) => handleCloudAuthTokenChange(e.target.value)}
        />
        {errors?.dbtCloudAuthToken && errorMsg(errors.dbtCloudAuthToken)}
      </Field>

      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="dbtCloudProjectId">
          {t('label.dbt-cloud-project-id')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-cloud-type', { type: t('label.project-lowercase') })}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbtCloudProjectId"
          id="dbtCloudProjectId"
          name="dbtCloudProjectId"
          type="text"
          value={dbtCloudProjectId}
          onChange={(e) => handleDbtCloudProjectId(e.target.value)}
        />
      </Field>
      <Field>
        <label className="block tw-mb-1 tw-form-label" htmlFor="dbtCloudJobId">
          {t('label.dbt-cloud-job-id')}
        </label>
        <p className="text-grey-muted m-t-xss m-b-xs text-xs">
          {t('message.dbt-cloud-type', { type: t('label.job-lowercase') })}
        </p>
        <Input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbtCloudJobId"
          id="dbtCloudJobId"
          name="dbtCloudJobId"
          type="text"
          value={dbtCloudJobId}
          onChange={(e) => handleDbtCloudJobId(e.target.value)}
        />
      </Field>

      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="dbtCloudUrl">
          {requiredField(t('label.dbt-cloud-url'))}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.unable-to-connect-to-your-dbt-cloud-instance')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbtCloudUrl"
          id="dbtCloudUrl"
          name="dbtCloudUrl"
          type="text"
          value={dbtCloudUrl}
          onChange={(e) => handleDbtCloudUrl(e.target.value)}
        />
      </Field>
      {getSeparator('')}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="cloud-update-description"
        enableDebugLog={enableDebugLog}
        handleEnableDebugLogCheck={handleEnableDebugLogCheck}
        handleIncludeTagsClick={handleIncludeTagsClick}
        handleUpdateDBTClassification={handleUpdateDBTClassification}
        handleUpdateDescriptions={handleUpdateDescriptions}
        includeTags={includeTags}
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
