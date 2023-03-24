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

import { Button } from 'antd';
import { t } from 'i18next';
import React, { Fragment, FunctionComponent, useState } from 'react';
import { DbtConfig } from '../../../generated/metadataIngestion/dbtPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import { validateDbtLocalConfig } from '../../../utils/DBTConfigFormUtil';
import { Field } from '../../Field/Field';
import DBTCommonFields from './DBTCommonFields.component';
import {
  DbtConfigLocal,
  DBTFormCommonProps,
  ErrorDbtLocal,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigLocal {
  handleCatalogFilePathChange: (value: string) => void;
  handleManifestFilePathChange: (value: string) => void;
  handleRunResultsFilePathChange: (value: string) => void;
  handleUpdateDescriptions: (value: boolean) => void;
  handleUpdateDBTClassification: (value: string) => void;
  enableDebugLog: boolean;
  handleEnableDebugLogCheck: (value: boolean) => void;
}

export const DBTLocalConfig: FunctionComponent<Props> = ({
  dbtCatalogFilePath = '',
  dbtManifestFilePath = '',
  dbtRunResultsFilePath = '',
  dbtUpdateDescriptions = false,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleCatalogFilePathChange,
  handleManifestFilePathChange,
  handleRunResultsFilePathChange,
  handleUpdateDescriptions,
  dbtClassificationName,
  handleUpdateDBTClassification,
  enableDebugLog,
  handleEnableDebugLogCheck,
}: Props) => {
  const [errors, setErrors] = useState<ErrorDbtLocal>();

  const validate = (data: DbtConfig) => {
    const { isValid, errors: reqErrors } = validateDbtLocalConfig(data);
    setErrors(reqErrors);

    return isValid;
  };

  const handleSubmit = () => {
    const submitData = {
      dbtCatalogFilePath,
      dbtManifestFilePath,
      dbtRunResultsFilePath,
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
          htmlFor="catalog-file">
          {t('label.dbt-catalog-file-path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-catalog-file-extract-path')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="catalog-file"
          id="catalog-file"
          name="catalog-file"
          type="text"
          value={dbtCatalogFilePath}
          onChange={(e) => handleCatalogFilePathChange(e.target.value)}
        />
        {errors?.dbtCatalogFilePath && errorMsg(errors.dbtCatalogFilePath)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="manifest-file">
          {requiredField(t('message.dbt-manifest-file-path'))}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-manifest-file-path')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="manifest-file"
          id="manifest-file"
          name="manifest-file"
          type="text"
          value={dbtManifestFilePath}
          onChange={(e) => handleManifestFilePathChange(e.target.value)}
        />
        {errors?.dbtManifestFilePath && errorMsg(errors.dbtManifestFilePath)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="run-result-file">
          {t('label.dbt-run-result-file-path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-result-file-path')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="run-result-file"
          id="run-result-file"
          name="run-result-file"
          type="text"
          value={dbtRunResultsFilePath}
          onChange={(e) => handleRunResultsFilePathChange(e.target.value)}
        />
        {errors?.dbtRunResultsFilePath &&
          errorMsg(errors.dbtRunResultsFilePath)}
      </Field>
      {getSeparator('')}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="local-update-description"
        enableDebugLog={enableDebugLog}
        handleEnableDebugLogCheck={handleEnableDebugLogCheck}
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
