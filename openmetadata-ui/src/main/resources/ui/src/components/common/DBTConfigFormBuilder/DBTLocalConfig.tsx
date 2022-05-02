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
import { DbtConfigSource } from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import { validateDbtLocalConfig } from '../../../utils/DBTConfigFormUtil';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
import {
  DbtConfigLocal,
  DBTFormCommonProps,
  ErrorDbtLocal,
} from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigLocal {
  handleCatalogFilePathChange: (value: string) => void;
  handleManifestFilePathChange: (value: string) => void;
}

export const DBTLocalConfig: FunctionComponent<Props> = ({
  dbtCatalogFilePath = '',
  dbtManifestFilePath = '',
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleCatalogFilePathChange,
  handleManifestFilePathChange,
}: Props) => {
  const [errors, setErrors] = useState<ErrorDbtLocal>();

  const validate = (data: DbtConfigSource) => {
    const { isValid, errors: reqErrors } = validateDbtLocalConfig(data);
    setErrors(reqErrors);

    return isValid;
  };

  const handleSubmit = () => {
    const submitData = { dbtCatalogFilePath, dbtManifestFilePath };
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
          {requiredField('DBT Catalog File Path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT catalog file to extract dbt models with their column schemas.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
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
          {requiredField('DBT Manifest File Path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT manifest file path to extract dbt models and associate with
          tables.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="manifest-file"
          id="manifest-file"
          name="manifest-file"
          type="text"
          value={dbtManifestFilePath}
          onChange={(e) => handleManifestFilePathChange(e.target.value)}
        />
        {errors?.dbtManifestFilePath && errorMsg(errors.dbtManifestFilePath)}
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
