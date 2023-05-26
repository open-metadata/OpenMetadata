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
import { generateFormFields, getField } from 'utils/formUtils';
import { GCSCredentialsValues } from '../../../generated/metadataIngestion/dbtPipeline';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigS3GCS } from './DBTConfigForm.interface';
import { GCSCreds } from './DBTFormConstants';
import { GCS_CONFIG } from './DBTFormEnum';

interface Props extends DbtConfigS3GCS {
  gcsType?: GCS_CONFIG;
  enableDebugLog: boolean;
}

export const DBTGCSConfig: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtUpdateDescriptions = false,
  gcsType = GCS_CONFIG.GCSValues,
  includeTags = true,
  dbtClassificationName,
  enableDebugLog,
}: Props) => {
  const dbtPrefixConfigFields: FieldProp[] = [
    {
      name: 'dbtBucketName',
      label: t('label.dbt-bucket-name'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'dbt-bucket-name',
      },
      id: 'root/dbtBucketName',
      formItemProps: {
        initialValue: dbtPrefixConfig?.dbtBucketName,
      },
    },
    {
      name: 'dbtObjectPrefix',
      label: t('label.dbt-object-prefix'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'dbt-object-prefix',
      },
      id: 'root/dbtObjectPrefix',
      formItemProps: {
        initialValue: dbtPrefixConfig?.dbtObjectPrefix,
      },
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
          'data-testid': 'credential-type',
        },
        formItemProps: {
          initialValue: gcsConfig?.type,
        },
      },
      {
        name: 'projectId',
        id: 'root/projectId',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.project-id'),
        props: {
          'data-testid': 'project-id',
        },
        formItemProps: {
          initialValue: gcsConfig?.projectId,
        },
      },
      {
        name: 'privateKeyId',
        id: 'root/privateKeyId',
        required: false,
        type: FieldTypes.PASSWORD,
        label: t('label.private-key-id'),
        props: {
          'data-testid': 'private-key-id',
        },
        formItemProps: {
          initialValue: gcsConfig?.privateKeyId,
        },
      },
      {
        name: 'privateKey',
        id: 'root/privateKey',
        required: false,
        type: FieldTypes.PASSWORD,
        label: t('label.private-key'),
        props: {
          'data-testid': 'private-key',
        },
        formItemProps: {
          initialValue: gcsConfig?.privateKey,
        },
      },
      {
        name: 'clientEmail',
        id: 'root/clientEmail',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.client-email'),
        props: {
          'data-testid': 'client-email',
        },
        formItemProps: {
          initialValue: gcsConfig?.clientEmail,
        },
      },
      {
        name: 'clientId',
        id: 'root/clientId',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.client-id'),
        props: {
          'data-testid': 'client-id',
        },
        formItemProps: {
          initialValue: gcsConfig?.clientId,
        },
      },
      {
        name: 'authUri',
        id: 'root/authUri',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.authentication-uri'),
        props: {
          type: 'url',
          'data-testid': 'auth-uri',
        },
        formItemProps: {
          initialValue: gcsConfig?.authUri,
        },
      },
      {
        name: 'tokenUri',
        id: 'root/tokenUri',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.token-uri'),
        props: {
          'data-testid': 'token-uri',
          type: 'url',
        },
        formItemProps: {
          initialValue: gcsConfig?.tokenUri,
        },
      },
      {
        name: 'authProviderX509CertUrl',
        id: 'root/authProviderX509CertUrl',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.auth-x509-certificate-url'),
        props: {
          'data-testid': 'auth-x509-certificate-uri',
        },
        formItemProps: {
          initialValue: gcsConfig?.authProviderX509CertUrl,
        },
      },
      {
        name: 'clientX509CertUrl',
        id: 'root/clientX509CertUrl',
        required: false,
        type: FieldTypes.TEXT,
        label: t('label.client-x509-certificate-url'),
        props: {
          'data-testid': 'client-x509-certificate-uri',
        },
        formItemProps: {
          initialValue: gcsConfig?.clientX509CertUrl,
        },
      },
    ];

    return (
      <Fragment key="dbt-gcs-value-config">
        {generateFormFields(gcsCredConfigFields)}
      </Fragment>
    );
  };

  const gcsCredPathFields: FieldProp[] = [
    {
      name: 'GCSCredentialsPath',
      label: t('label.gcs-credential-path'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'gcs-cred-path',
      },
      id: 'root/GCSCredentialsPath',
      formItemProps: {
        initialValue: dbtSecurityConfig?.gcsConfig || '',
      },
    },
  ];

  return (
    <Fragment key="dbt-gcs-config">
      {getField({
        name: 'gcsConfig',
        id: 'root/gcsConfig',
        type: FieldTypes.SELECT,
        required: false,
        label: t('label.dbt-configuration-source-type'),
        props: {
          options: GCSCreds,
          'data-testid': 'gcs-config',
        },
        formItemProps: {
          initialValue: gcsType,
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
        includeTags={includeTags}
      />
    </Fragment>
  );
};
