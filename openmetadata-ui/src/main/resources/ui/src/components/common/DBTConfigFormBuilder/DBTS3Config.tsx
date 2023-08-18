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
import { DbtConfigS3GCS } from './DBTConfigForm.interface';

interface Props extends DbtConfigS3GCS {
  enableDebugLog: boolean;
  parsingTimeoutLimit: number;
}

export const DBTS3Config: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtUpdateDescriptions = false,
  includeTags = true,
  dbtClassificationName,
  enableDebugLog,
  parsingTimeoutLimit,
}: Props) => {
  const s3ConfigFields: FieldProp[] = [
    {
      name: 'awsAccessKeyId',
      label: t('label.aws-access-key-id'),
      type: FieldTypes.PASSWORD,
      required: false,
      props: {
        'data-testid': 'aws-access-key-id',
      },
      id: 'root/awsAccessKeyId',
      formItemProps: {
        initialValue: dbtSecurityConfig?.awsAccessKeyId,
      },
    },
    {
      name: 'awsSecretAccessKey',
      label: t('label.aws-secret-access-key'),
      type: FieldTypes.PASSWORD,
      required: false,
      props: {
        'data-testid': 'aws-secret-access-key-id',
      },
      id: 'root/awsSecretAccessKey',
      formItemProps: {
        initialValue: dbtSecurityConfig?.awsSecretAccessKey,
      },
    },
    {
      name: 'awsRegion',
      label: t('label.aws-region'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'awsRegion',
      },
      id: 'root/awsRegion',
      formItemProps: {
        initialValue: dbtSecurityConfig?.awsRegion,
      },
    },
    {
      name: 'awsSessionToken',
      label: t('label.aws-session-token'),
      type: FieldTypes.PASSWORD,
      required: false,
      props: {
        'data-testid': 'aws-session-token',
      },
      id: 'root/awsSessionToken',
      formItemProps: {
        initialValue: dbtSecurityConfig?.awsSessionToken,
      },
    },
    {
      name: 'endPointURL',
      label: t('label.endpoint-url'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'endpoint-url',
        type: 'url',
      },
      id: 'root/endPointURL',
      formItemProps: {
        initialValue: dbtSecurityConfig?.endPointURL,
      },
    },
    {
      name: 'profileName',
      label: t('label.profile-name'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'profileName',
      },
      id: 'root/profileName',
      formItemProps: {
        initialValue: dbtSecurityConfig?.profileName,
      },
    },
    {
      name: 'assumeRoleArn',
      label: t('label.assume-role-arn'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'assumeRoleArn',
      },
      id: 'root/assumeRoleArn',
      formItemProps: {
        initialValue: dbtSecurityConfig?.assumeRoleArn,
      },
    },
    {
      name: 'assumeRoleSessionName',
      label: t('label.assume-role-session-name'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'assumeRoleSessionName',
      },
      id: 'root/assumeRoleSessionName',
      formItemProps: {
        initialValue:
          dbtSecurityConfig?.assumeRoleSessionName ?? 'OpenMetadataSession',
      },
    },
    {
      name: 'assumeRoleSourceIdentity',
      label: t('label.assume-role-source-identity'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'assumeRoleSourceIdentity',
      },
      id: 'root/assumeRoleSourceIdentity',
      formItemProps: {
        initialValue: dbtSecurityConfig?.assumeRoleSourceIdentity,
      },
    },
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

  return (
    <Fragment key="dbt-s3-config">
      {generateFormFields(s3ConfigFields)}
      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="s3-update-description"
        enableDebugLog={enableDebugLog}
        includeTags={includeTags}
        parsingTimeoutLimit={parsingTimeoutLimit}
      />
    </Fragment>
  );
};
