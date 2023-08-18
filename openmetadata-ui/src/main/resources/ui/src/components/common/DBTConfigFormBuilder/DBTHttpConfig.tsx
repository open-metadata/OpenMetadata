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

import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import React, { Fragment, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { generateFormFields } from 'utils/formUtils';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigHttp } from './DBTConfigForm.interface';

interface Props extends DbtConfigHttp {
  enableDebugLog: boolean;
  parsingTimeoutLimit: number;
}

export const DBTHttpConfig: FunctionComponent<Props> = ({
  dbtCatalogHttpPath = '',
  dbtManifestHttpPath = '',
  dbtRunResultsHttpPath = '',
  dbtUpdateDescriptions = false,
  includeTags = true,
  dbtClassificationName,
  enableDebugLog,
  parsingTimeoutLimit,
}: Props) => {
  const { t } = useTranslation();

  const httpConfigFields: FieldProp[] = [
    {
      name: 'dbtCatalogHttpPath',
      label: t('label.dbt-catalog-http-path'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'catalog-url',
      },
      id: 'root/dbtCatalogHttpPath',
      formItemProps: {
        initialValue: dbtCatalogHttpPath,
      },
    },
    {
      name: 'dbtManifestHttpPath',
      label: t('label.dbt-manifest-file-path'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'manifest-url',
      },
      id: 'root/dbtManifestHttpPath',
      formItemProps: {
        initialValue: dbtManifestHttpPath,
      },
    },
    {
      name: 'dbtRunResultsHttpPath',
      label: t('label.dbt-run-result-http-path'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'run-result-file',
      },
      id: 'root/dbtRunResultsHttpPath',
      formItemProps: {
        initialValue: dbtRunResultsHttpPath,
      },
    },
  ];

  return (
    <Fragment key="dbt-http-config">
      {generateFormFields(httpConfigFields)}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="http-update-description"
        enableDebugLog={enableDebugLog}
        includeTags={includeTags}
        parsingTimeoutLimit={parsingTimeoutLimit}
      />
    </Fragment>
  );
};
