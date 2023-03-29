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
import React, { Fragment, FunctionComponent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DbtConfig } from '../../../generated/metadataIngestion/dbtPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import { validateDbtHttpConfig } from '../../../utils/DBTConfigFormUtil';
import { Field } from '../../Field/Field';
import DBTCommonFields from './DBTCommonFields.component';
import {
  DbtConfigHttp,
  DBTFormCommonProps,
  ErrorDbtHttp,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigHttp {
  handleCatalogHttpPathChange: (value: string) => void;
  handleManifestHttpPathChange: (value: string) => void;
  handleRunResultsHttpPathChange: (value: string) => void;
  handleUpdateDescriptions: (value: boolean) => void;
  handleUpdateDBTClassification: (value: string) => void;
  enableDebugLog: boolean;
  handleEnableDebugLogCheck: (value: boolean) => void;
  handleIncludeTagsClick: (value: boolean) => void;
}

export const DBTHttpConfig: FunctionComponent<Props> = ({
  dbtCatalogHttpPath = '',
  dbtManifestHttpPath = '',
  dbtRunResultsHttpPath = '',
  dbtUpdateDescriptions = false,
  includeTags = true,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleCatalogHttpPathChange,
  handleManifestHttpPathChange,
  handleRunResultsHttpPathChange,
  handleUpdateDescriptions,
  dbtClassificationName,
  handleUpdateDBTClassification,
  enableDebugLog,
  handleEnableDebugLogCheck,
  handleIncludeTagsClick,
}: Props) => {
  const [errors, setErrors] = useState<ErrorDbtHttp>();
  const { t } = useTranslation();

  const validate = (data: DbtConfig) => {
    const { isValid, errors: reqErrors } = validateDbtHttpConfig(data);
    setErrors(reqErrors);

    return isValid;
  };

  const handleSubmit = () => {
    const submitData = {
      dbtCatalogHttpPath,
      dbtManifestHttpPath,
      dbtRunResultsHttpPath,
      dbtUpdateDescriptions,
      dbtClassificationName,
      includeTags,
    };
    if (validate(submitData)) {
      onSubmit(submitData);
    }
  };

  return (
    <Fragment>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="catalog-url">
          {t('label.dbt-catalog-http-path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-catalog-file-extract-path')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="catalog-url"
          id="catalog-url"
          name="catalog-url"
          type="text"
          value={dbtCatalogHttpPath}
          onChange={(e) => handleCatalogHttpPathChange(e.target.value)}
        />
        {errors?.dbtCatalogHttpPath && errorMsg(errors.dbtManifestHttpPath)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="manifest-url">
          {requiredField(t('message.dbt-manifest-file-path'))}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-manifest-file-path')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="manifest-url"
          id="manifest-url"
          name="manifest-url"
          type="text"
          value={dbtManifestHttpPath}
          onChange={(e) => handleManifestHttpPathChange(e.target.value)}
        />
        {errors?.dbtManifestHttpPath && errorMsg(errors.dbtManifestHttpPath)}
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="run-result-file">
          {t('label.dbt-run-result-http-path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.dbt-run-result-http-path-message')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="run-result-file"
          id="run-result-file"
          name="run-result-file"
          type="text"
          value={dbtRunResultsHttpPath}
          onChange={(e) => handleRunResultsHttpPathChange(e.target.value)}
        />
        {errors?.dbtRunResultsHttpPath &&
          errorMsg(errors.dbtRunResultsHttpPath)}
      </Field>
      {getSeparator('')}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="http-update-description"
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
