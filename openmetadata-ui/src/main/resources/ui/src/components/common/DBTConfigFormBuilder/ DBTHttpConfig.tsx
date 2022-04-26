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
  extends Pick<DbtConfigSource, 'dbtCatalogHttpPath' | 'dbtManifestHttpPath'> {
  handleCatalogHttpPathChange: (value: string) => void;
  handleManifestHttpPathChange: (value: string) => void;
}

export const DBTHttpConfig: FunctionComponent<Props> = ({
  dbtCatalogHttpPath = '',
  dbtManifestHttpPath = '',
  handleCatalogHttpPathChange,
  handleManifestHttpPathChange,
}: Props) => {
  return (
    <Fragment>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="catalog-url">
          DBT Catalog URL
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT catalog file to extract dbt models with their column schemas.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="catalog-url"
          id="catalog-url"
          name="catalog-url"
          type="text"
          value={dbtCatalogHttpPath}
          onChange={(e) => handleCatalogHttpPathChange(e.target.value)}
        />
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="manifest-url">
          DBT Manifest URL
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          DBT manifest file path to extract dbt models and associate with
          tables.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="manifest-url"
          id="manifest-url"
          name="manifest-url"
          type="text"
          value={dbtManifestHttpPath}
          onChange={(e) => handleManifestHttpPathChange(e.target.value)}
        />
      </Field>
    </Fragment>
  );
};
