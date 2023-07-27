/*
 *  Copyright 2023 Collate.
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
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { generateFormFields } from 'utils/formUtils';
import DBTCommonFields from './DBTCommonFields.component';
import { DbtConfigAzure } from './DBTConfigForm.interface';

interface Props extends DbtConfigAzure {
  enableDebugLog: boolean;
}

export const DBTAzureConfig = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtClassificationName,
  dbtUpdateDescriptions = false,
  enableDebugLog,
  includeTags = true,
}: Props) => {
  const { t } = useTranslation();
  const azureConfigFields: FieldProp[] = [
    {
      name: 'clientId',
      label: t('label.client-id'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'azure-client-id',
      },
      id: 'root/azureClientId',
      formItemProps: {
        initialValue: dbtSecurityConfig?.clientId,
      },
    },
    {
      name: 'clientSecret',
      label: t('label.client-secret'),
      type: FieldTypes.PASSWORD,
      required: true,
      props: {
        'data-testid': 'azure-client-secret',
      },
      id: 'root/azureClientSecret',
      formItemProps: {
        initialValue: dbtSecurityConfig?.clientSecret,
      },
    },
    {
      name: 'tenantId',
      label: t('label.tenant-id'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'azure-tenant-id',
      },
      id: 'root/azureTenantId',
      formItemProps: {
        initialValue: dbtSecurityConfig?.tenantId,
      },
    },
    {
      name: 'accountName',
      label: t('label.account-name'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        'data-testid': 'azure-account-name',
      },
      id: 'root/azureAccountName',
      formItemProps: {
        initialValue: dbtSecurityConfig?.accountName,
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
    <Fragment key="dbt-azure-config">
      {generateFormFields(azureConfigFields)}
      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="azure-update-description"
        enableDebugLog={enableDebugLog}
        includeTags={includeTags}
      />
    </Fragment>
  );
};
