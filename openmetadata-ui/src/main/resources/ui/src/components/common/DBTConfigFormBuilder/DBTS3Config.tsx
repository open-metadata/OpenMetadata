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
import { t } from 'i18next';
import React, { Fragment, FunctionComponent } from 'react';
import { FieldProp, FieldTypes, generateFormFields } from 'utils/formUtils';
import {
  DBTBucketDetails,
  SCredentials,
} from '../../../generated/metadataIngestion/dbtPipeline';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigS3GCS, DBTFormCommonProps } from './DBTConfigForm.interface';

interface Props extends DBTFormCommonProps, DbtConfigS3GCS {
  enableDebugLog: boolean;
  handleEnableDebugLogCheck: (value: boolean) => void;
  onConfigUpdate: (
    key: keyof ModifiedDbtConfig,
    val?: string | boolean | SCredentials | DBTBucketDetails
  ) => void;
}

export const DBTS3Config: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtUpdateDescriptions = false,
  includeTags = true,
  dbtClassificationName,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  enableDebugLog,
  handleEnableDebugLogCheck,
  onConfigUpdate,
}: Props) => {
  const updateS3Credentials = (key: keyof SCredentials, val: string) => {
    const updatedCredentials: SCredentials = {
      ...dbtSecurityConfig,
      [key]: val,
    };
    delete updatedCredentials.gcsConfig;
    onConfigUpdate('dbtPrefixConfig', updatedCredentials);
  };

  const updateDbtBucket = (key: keyof DBTBucketDetails, val: string) => {
    const updatedBucket: DBTBucketDetails = {
      ...dbtPrefixConfig,
      [key]: val,
    };
    onConfigUpdate('dbtPrefixConfig', updatedBucket);
  };

  const handleSubmit = () => {
    const submitData = {
      dbtSecurityConfig,
      dbtPrefixConfig,
      dbtUpdateDescriptions,
      dbtClassificationName,
      includeTags,
    };

    onSubmit(submitData);
  };

  const s3ConfigFields: FieldProp[] = [
    {
      name: 'awsAccessKeyId',
      label: t('label.aws-access-key-id'),
      type: FieldTypes.PASSWORD,
      required: false,
      props: {
        value: dbtSecurityConfig?.awsAccessKeyId,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateS3Credentials('awsAccessKeyId', e.target.value),
        'data-testid': 'aws-access-key-id',
      },
      id: 'root/awsAccessKeyId',
    },
    {
      name: 'awsSecretAccessKey',
      label: t('label.aws-secret-access-key'),
      type: FieldTypes.PASSWORD,
      required: false,
      props: {
        value: dbtSecurityConfig?.awsSecretAccessKey,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateS3Credentials('awsSecretAccessKey', e.target.value),
        'data-testid': 'aws-secret-access-key-id',
      },
      id: 'root/awsSecretAccessKey',
    },
    {
      name: 'awsRegion',
      label: t('label.aws-region'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        value: dbtSecurityConfig?.awsRegion,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateS3Credentials('awsRegion', e.target.value),
        'data-testid': 'awsRegion',
      },
      id: 'root/awsRegion',
    },
    {
      name: 'awsSessionToken',
      label: t('label.aws-session-token'),
      type: FieldTypes.PASSWORD,
      required: false,
      props: {
        value: dbtSecurityConfig?.awsSessionToken,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateS3Credentials('awsSessionToken', e.target.value),
        'data-testid': 'aws-session-token',
      },
      id: 'root/awsSessionToken',
    },
    {
      name: 'endPointURL',
      label: t('label.endpoint-url'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtSecurityConfig?.endPointURL,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateS3Credentials('endPointURL', e.target.value),
        'data-testid': 'endpoint-url',
        type: 'url',
      },
      id: 'root/endPointURL',
    },
    {
      name: 'dbtBucketName',
      label: t('label.dbt-bucket-name'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtPrefixConfig?.dbtBucketName,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateDbtBucket('dbtBucketName', e.target.value),
        'data-testid': 'dbt-bucket-name',
      },
      id: 'root/dbtBucketName',
    },
    {
      name: 'dbtObjectPrefix',
      label: t('label.dbt-object-prefix'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        value: dbtPrefixConfig?.dbtObjectPrefix,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateDbtBucket('dbtObjectPrefix', e.target.value),
        'data-testid': 'dbt-object-prefix',
      },
      id: 'root/dbtObjectPrefix',
    },
  ];

  return (
    <Fragment>
      {generateFormFields(s3ConfigFields)}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="s3-update-description"
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
