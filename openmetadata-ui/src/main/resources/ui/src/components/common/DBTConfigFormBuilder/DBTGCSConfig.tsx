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
import { isObject } from 'lodash';
import React, { Fragment, FunctionComponent, useEffect, useRef } from 'react';
import {
  FieldProp,
  FieldTypes,
  generateFormFields,
  getField,
} from 'utils/formUtils';
import {
  DBTBucketDetails,
  GCSCredentialsValues,
  SCredentials,
} from '../../../generated/metadataIngestion/dbtPipeline';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigS3GCS, DBTFormCommonProps } from './DBTConfigForm.interface';
import { GCSCreds } from './DBTFormConstants';
import { GCS_CONFIG } from './DBTFormEnum';

interface Props extends DBTFormCommonProps, DbtConfigS3GCS {
  gcsType?: GCS_CONFIG;
  enableDebugLog: boolean;
  handleGcsTypeChange: (type: GCS_CONFIG) => void;
  handleEnableDebugLogCheck: (value: boolean) => void;
  onConfigUpdate: (
    key: keyof ModifiedDbtConfig,
    val?: string | boolean | SCredentials | DBTBucketDetails
  ) => void;
}

export const DBTGCSConfig: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtUpdateDescriptions = false,
  gcsType = GCS_CONFIG.GCSValues,
  includeTags = true,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleGcsTypeChange,
  dbtClassificationName,
  enableDebugLog,
  handleEnableDebugLogCheck,
  onConfigUpdate,
}: Props) => {
  const isMounted = useRef<boolean>(false);
  const updateGCSCredentialsConfig = (
    key: keyof GCSCredentialsValues,
    val: string
  ) => {
    const gcsConfig = isObject(dbtSecurityConfig?.gcsConfig)
      ? dbtSecurityConfig?.gcsConfig
      : {};
    const updatedCredentials: SCredentials = {
      gcsConfig: {
        ...(gcsConfig as GCSCredentialsValues),
        [key]: val,
      },
    };
    onConfigUpdate('dbtSecurityConfig', updatedCredentials);
  };

  const updateDbtBucket = (key: keyof DBTBucketDetails, val: string) => {
    const updatedBucket: DBTBucketDetails = {
      ...dbtPrefixConfig,
      [key]: val,
    };
    onConfigUpdate('dbtPrefixConfig', updatedBucket);
  };

  const updateGCSCredentialsPath = (val: string) => {
    const updatedCredentials: SCredentials = {
      gcsConfig: val,
    };
    onConfigUpdate('dbtSecurityConfig', updatedCredentials);
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

  const dbtPrefixConfigFields: FieldProp[] = [
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

  const gcsCredConfigs = (gcsConfig?: GCSCredentialsValues) => {
    const gcsCredConfigFields: FieldProp[] = [
      {
        name: 'type',
        id: 'root/type',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.credentials-type'),
        props: {
          value: gcsConfig?.type,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('type', e.target.value),
          'data-testid': 'credential-type',
        },
      },
      {
        name: 'projectId',
        id: 'root/projectId',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.project-id'),
        props: {
          value: gcsConfig?.projectId,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('projectId', e.target.value),
          'data-testid': 'project-id',
        },
      },
      {
        name: 'privateKeyId',
        id: 'root/privateKeyId',
        required: false,
        type: FieldTypes.PASSWORD,
        label: t('label.private-key-id'),
        props: {
          value: gcsConfig?.privateKeyId,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('privateKeyId', e.target.value),
          'data-testid': 'private-key-id',
        },
      },
      {
        name: 'privateKey',
        id: 'root/privateKey',
        required: false,
        type: FieldTypes.PASSWORD,
        label: t('label.private-key'),
        props: {
          value: gcsConfig?.privateKey,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('privateKey', e.target.value),
          'data-testid': 'private-key',
        },
      },
      {
        name: 'clientEmail',
        id: 'root/clientEmail',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.client-email'),
        props: {
          value: gcsConfig?.clientEmail,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('clientEmail', e.target.value),
          'data-testid': 'client-email',
        },
      },
      {
        name: 'clientId',
        id: 'root/clientId',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.client-id'),
        props: {
          value: gcsConfig?.clientId,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('clientId', e.target.value),
          'data-testid': 'client-id',
        },
      },
      {
        name: 'authUri',
        id: 'root/authUri',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.authentication-uri'),
        props: {
          value: gcsConfig?.authUri,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('authUri', e.target.value),
          'data-testid': 'auth-uri',
          type: 'url',
        },
      },
      {
        name: 'tokenUri',
        id: 'root/tokenUri',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.token-uri'),
        props: {
          value: gcsConfig?.tokenUri,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('tokenUri', e.target.value),
          'data-testid': 'token-uri',
          type: 'url',
        },
      },
      {
        name: 'authProviderX509CertUrl',
        id: 'root/authProviderX509CertUrl',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.auth-x509-certificate-url'),
        props: {
          value: gcsConfig?.authProviderX509CertUrl,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig(
              'authProviderX509CertUrl',
              e.target.value
            ),
          'data-testid': 'auth-x509-certificate-uri',
        },
      },
      {
        name: 'clientX509CertUrl',
        id: 'root/clientX509CertUrl',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.client-x509-certificate-url'),
        props: {
          value: gcsConfig?.clientX509CertUrl,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            updateGCSCredentialsConfig('clientX509CertUrl', e.target.value),
          'data-testid': 'client-x509-certificate-uri',
        },
      },
    ];

    return <Fragment>{generateFormFields(gcsCredConfigFields)}</Fragment>;
  };

  const gcsCredPathFields: FieldProp[] = [
    {
      name: 'GCSCredentialsPath',
      label: t('label.gcs-credential-path'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        value: dbtSecurityConfig?.gcsConfig || '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          updateGCSCredentialsPath(e.target.value),
        'data-testid': 'gcs-cred-path',
      },
      id: 'root/GCSCredentialsPath',
    },
  ];

  useEffect(() => {
    if (isMounted.current) {
      onConfigUpdate('dbtSecurityConfig');
    }
  }, [gcsType]);

  useEffect(() => {
    isMounted.current = true;
  }, []);

  return (
    <Fragment>
      {getField({
        name: 'gcsConfig',
        id: 'root/gcsConfig',
        type: FieldTypes.SELECT,
        required: false,
        label: t('label.dbt-configuration-source-type'),
        props: {
          options: GCSCreds,
          value: gcsType,
          onChange: handleGcsTypeChange,
          'data-testid': 'gcs-config',
        },
      })}

      {gcsType === GCS_CONFIG.GCSValues
        ? gcsCredConfigs(dbtSecurityConfig?.gcsConfig as GCSCredentialsValues)
        : generateFormFields(gcsCredPathFields)}

      {generateFormFields(dbtPrefixConfigFields)}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="gcs-update-description"
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
