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
import { useTranslation } from 'react-i18next';
import { DbtConfig } from '../../../generated/metadataIngestion/dbtPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import { validateDbtHttpConfig } from '../../../utils/DBTConfigFormUtil';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
import {
  DbtConfigHttp,
  DBTFormCommonProps,
  ErrorDbtHttp,
} from './DBTConfigForm.interface';
import SwitchField from './SwitchField.component';

interface Props extends DBTFormCommonProps, DbtConfigHttp {
  handleCatalogHttpPathChange: (value: string) => void;
  handleManifestHttpPathChange: (value: string) => void;
  handleRunResultsHttpPathChange: (value: string) => void;
  handleUpdateDescriptions: (value: boolean) => void;
}

export const DBTHttpConfig: FunctionComponent<Props> = ({
  dbtCatalogHttpPath = '',
  dbtManifestHttpPath = '',
  dbtRunResultsHttpPath = '',
  dbtUpdateDescriptions = false,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleCatalogHttpPathChange,
  handleManifestHttpPathChange,
  handleRunResultsHttpPathChange,
  handleUpdateDescriptions,
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
    };
    if (validate(submitData)) {
      onSubmit(submitData);
    }
  };

  return (
    <Fragment>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="catalog-url">
          DBT Catalog HTTP Path
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT catalog file to extract dbt models with their column schemas.
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
          {requiredField('DBT Manifest HTTP Path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT manifest file path to extract dbt models and associate with
          tables.
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

      <SwitchField
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        handleUpdateDescriptions={handleUpdateDescriptions}
        id="http-update-description"
      />

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
