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
import React, { Fragment, FunctionComponent } from 'react';
import { FieldProp, FieldTypes, generateFormFields } from 'utils/formUtils';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigCloud } from './DBTConfigForm.interface';

interface Props extends DbtConfigCloud {
  enableDebugLog: boolean;
}

export const DBTCloudConfig: FunctionComponent<Props> = ({
  dbtCloudAccountId = '',
  dbtCloudAuthToken = '',
  dbtCloudProjectId,
  dbtCloudJobId,
  dbtUpdateDescriptions = false,
  includeTags = true,
  dbtCloudUrl = 'https://cloud.getdbt.com/',
  dbtClassificationName,
  enableDebugLog,
}: Props) => {
  const cloudConfigFields: FieldProp[] = [
    {
      name: 'dbtCloudAccountId',
      label: t('label.dbt-cloud-account-id'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'cloud-account-id',
      },
      id: 'root/dbtCloudAccountId',
      formItemProps: {
        initialValue: dbtCloudAccountId,
      },
    },
    {
      name: 'dbtCloudAuthToken',
      label: t('label.dbt-cloud-account-auth-token'),
      type: FieldTypes.PASSWORD,
      required: true,
      props: {
        'data-testid': 'cloud-auth-token',
      },
      id: 'root/dbtCloudAuthToken',
      formItemProps: {
        initialValue: dbtCloudAuthToken,
      },
    },
    {
      name: 'dbtCloudProjectId',
      label: t('label.dbt-cloud-project-id'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'dbtCloudProjectId',
      },
      id: 'root/dbtCloudProjectId',
      formItemProps: {
        initialValue: dbtCloudProjectId,
      },
    },
    {
      name: 'dbtCloudJobId',
      label: t('label.dbt-cloud-job-id'),
      type: FieldTypes.TEXT,
      required: false,
      props: {
        'data-testid': 'dbtCloudJobId',
      },
      id: 'root/dbtCloudJobId',
      formItemProps: {
        initialValue: dbtCloudJobId,
      },
    },
    {
      name: 'dbtCloudUrl',
      label: t('label.dbt-cloud-url'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'dbtCloudUrl',
      },
      id: 'root/dbtCloudUrl',
      formItemProps: {
        initialValue: dbtCloudUrl,
      },
    },
  ];

  return (
    <Fragment key="dbt-cloud-config">
      {generateFormFields(cloudConfigFields)}
      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="cloud-update-description"
        enableDebugLog={enableDebugLog}
        includeTags={includeTags}
      />
    </Fragment>
  );
};
