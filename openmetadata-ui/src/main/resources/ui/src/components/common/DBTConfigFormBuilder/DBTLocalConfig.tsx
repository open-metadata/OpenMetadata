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

import { t } from 'i18next';
import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import React, { Fragment, FunctionComponent } from 'react';
import { generateFormFields } from 'utils/formUtils';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigLocal } from './DBTConfigForm.interface';

interface Props extends DbtConfigLocal {
  enableDebugLog: boolean;
}

export const DBTLocalConfig: FunctionComponent<Props> = ({
  dbtCatalogFilePath = '',
  dbtManifestFilePath = '',
  dbtRunResultsFilePath = '',
  dbtUpdateDescriptions = false,
  includeTags = true,
  dbtClassificationName,
  enableDebugLog,
}: Props) => {
  const localConfigFields: FieldProp[] = [
    {
      name: 'dbtCatalogFilePath',
      label: t('label.dbt-catalog-file-path'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'catalog-file',
      },
      id: 'root/dbtCatalogFilePath',
      helperText: t('message.dbt-catalog-file-extract-path'),
      formItemProps: {
        initialValue: dbtCatalogFilePath,
      },
    },
    {
      name: 'dbtManifestFilePath',
      label: t('label.dbt-manifest-file-path'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'manifest-file',
      },
      id: 'root/dbtManifestFilePath',
      helperText: t('message.dbt-manifest-file-path'),
      formItemProps: {
        initialValue: dbtManifestFilePath,
      },
    },
    {
      name: 'dbtRunResultsFilePath',
      label: t('label.dbt-run-result-file-path'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'run-result-file',
      },
      id: 'root/dbtRunResultsFilePath',
      helperText: t('message.dbt-result-file-path'),
      formItemProps: {
        initialValue: dbtRunResultsFilePath,
      },
    },
  ];

  return (
    <Fragment key="dbt-local-config">
      {generateFormFields(localConfigFields)}
      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="local-update-description"
        enableDebugLog={enableDebugLog}
        includeTags={includeTags}
      />
    </Fragment>
  );
};
