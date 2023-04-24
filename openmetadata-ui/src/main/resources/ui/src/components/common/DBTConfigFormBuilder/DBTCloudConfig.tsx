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
} from 'generated/metadataIngestion/dbtPipeline';
import { t } from 'i18next';
import React, { Fragment, FunctionComponent } from 'react';
import { FieldProp, FieldTypes, generateFormFields } from 'utils/formUtils';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigCloud, DBTFormCommonProps } from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigCloud {
  enableDebugLog: boolean;
  onConfigUpdate: (
    key: keyof ModifiedDbtConfig,
    val?: string | boolean | SCredentials | DBTBucketDetails
  ) => void;
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
  dbtClassificationName,
  enableDebugLog,
  onConfigUpdate,
}: Props) => {
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

    onSubmit(submitData);
  };

  const cloudConfigFields: FieldProp[] = [
    {
      name: 'dbtCloudAccountId',
      label: t('label.dbt-cloud-account-id'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        value: dbtCloudAccountId,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtCloudAccountId', e.target.value),
        'data-testid': 'cloud-account-id',
      },
      id: 'root/dbtCloudAccountId',
    },
    {
      name: 'dbtCloudAuthToken',
      label: t('label.dbt-cloud-account-auth-token'),
      type: FieldTypes.PASSWORD,
      required: true,
      props: {
        value: dbtCloudAuthToken,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtCloudAuthToken', e.target.value),
        'data-testid': 'cloud-auth-token',
      },
      id: 'root/dbtCloudAuthToken',
    },
    {
      name: 'dbtCloudProjectId',
      label: t('label.dbt-cloud-project-id'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtCloudProjectId,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtCloudProjectId', e.target.value),
        'data-testid': 'dbtCloudProjectId',
      },
      id: 'root/dbtCloudProjectId',
    },
    {
      name: 'dbtCloudJobId',
      label: t('label.dbt-cloud-job-id'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtCloudJobId,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtCloudJobId', e.target.value),
        'data-testid': 'dbtCloudJobId',
      },
      id: 'root/dbtCloudJobId',
    },
    {
      name: 'dbtCloudUrl',
      label: t('label.dbt-cloud-url'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        value: dbtCloudUrl,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onConfigUpdate('dbtCloudUrl', e.target.value),
        'data-testid': 'dbtCloudUrl',
      },
      id: 'root/dbtCloudUrl',
    },
  ];

  return (
    <Fragment>
      {generateFormFields(cloudConfigFields)}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="cloud-update-description"
        enableDebugLog={enableDebugLog}
        includeTags={includeTags}
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
