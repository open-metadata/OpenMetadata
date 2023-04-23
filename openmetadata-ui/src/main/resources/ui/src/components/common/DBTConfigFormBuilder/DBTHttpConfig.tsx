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

import { Button, Space } from 'antd';
import { ModifiedDbtConfig } from 'components/AddIngestion/addIngestion.interface';
import {
  DBTBucketDetails,
  SCredentials,
} from 'generated/metadataIngestion/workflow';
import React, { Fragment, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldProp, FieldTypes, generateFormFields } from 'utils/formUtils';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigHttp, DBTFormCommonProps } from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigHttp {
  enableDebugLog: boolean;
  handleEnableDebugLogCheck: (value: boolean) => void;
  onConfigUpdate: (
    key: keyof ModifiedDbtConfig,
    val?: string | boolean | SCredentials | DBTBucketDetails
  ) => void;
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
  dbtClassificationName,
  enableDebugLog,
  handleEnableDebugLogCheck,
  onConfigUpdate,
}: Props) => {
  const { t } = useTranslation();

  const handleSubmit = () => {
    const submitData = {
      dbtCatalogHttpPath,
      dbtManifestHttpPath,
      dbtRunResultsHttpPath,
      dbtUpdateDescriptions,
      dbtClassificationName,
      includeTags,
    };

    onSubmit(submitData);
  };

  const httpConfigFields: FieldProp[] = [
    {
      name: 'dbtCatalogHttpPath',
      label: t('label.dbt-catalog-http-path'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtCatalogHttpPath,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtCatalogHttpPath', e.target.value),
        'data-testid': 'catalog-url',
      },
      id: 'root/dbtCatalogHttpPath',
    },
    {
      name: 'dbtManifestHttpPath',
      label: t('label.dbt-manifest-file-path'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        value: dbtManifestHttpPath,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtManifestHttpPath', e.target.value),
        'data-testid': 'manifest-url',
      },
      id: 'root/dbtManifestHttpPath',
    },
    {
      name: 'dbtRunResultsHttpPath',
      label: t('label.dbt-run-result-http-path'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtRunResultsHttpPath,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtRunResultsHttpPath', e.target.value),
        'data-testid': 'run-result-file',
      },
      id: 'root/dbtRunResultsHttpPath',
    },
  ];

  return (
    <Fragment>
      {generateFormFields(httpConfigFields)}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="http-update-description"
        enableDebugLog={enableDebugLog}
        handleEnableDebugLogCheck={handleEnableDebugLogCheck}
        includeTags={includeTags}
        onConfigUpdate={onConfigUpdate}
      />

      <Space className="w-full justify-end">
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
      </Space>
    </Fragment>
  );
};
