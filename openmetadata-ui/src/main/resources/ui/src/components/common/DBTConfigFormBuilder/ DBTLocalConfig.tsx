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

import React, { Fragment, FunctionComponent } from 'react';
import { DbtConfigSource } from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { Field } from '../../Field/Field';

interface Props
  extends Pick<DbtConfigSource, 'dbtCatalogFilePath' | 'dbtManifestFilePath'> {
  handleCatalogFilePathChange: (value: string) => void;
  handleManifestFilePathChange: (value: string) => void;
}

export const DBTLocalConfig: FunctionComponent<Props> = ({
  dbtCatalogFilePath = '',
  dbtManifestFilePath = '',
  handleCatalogFilePathChange,
  handleManifestFilePathChange,
}: Props) => {
  return (
    <Fragment>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="catalog-file">
          DBT Catalog File Path
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
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="manifest-file">
          DBT Manifest File Path
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
      </Field>
    </Fragment>
  );
};
