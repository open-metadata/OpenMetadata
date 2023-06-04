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

import { Button, Form, FormProps, Space } from 'antd';
import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import React, { FunctionComponent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { generateFormFields } from 'utils/formUtils';
import { FormSubmitType } from '../../../enums/form.enum';
import { DBTCloudConfig } from './DBTCloudConfig';
import { DBTConfigFormProps } from './DBTConfigForm.interface';
import { DBTSources } from './DBTFormConstants';
import { DBT_SOURCES, GCS_CONFIG } from './DBTFormEnum';
import { DBTGCSConfig } from './DBTGCSConfig';
import { DBTHttpConfig } from './DBTHttpConfig';
import { DBTLocalConfig } from './DBTLocalConfig';
import { DBTS3Config } from './DBTS3Config';

const DBTConfigFormBuilder: FunctionComponent<DBTConfigFormProps> = ({
  cancelText,
  data,
  formType,
  okText,
  onCancel,
  onChange,
  onSubmit,
  onFocus,
}: DBTConfigFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const currentDbtConfigSourceType = Form.useWatch('dbtConfigSource', form);
  const currentGcsConfigType = Form.useWatch('gcsConfig', form);

  const { dbtConfigSource, gcsConfigType, ingestionName, dbtConfigSourceType } =
    useMemo(
      () => ({
        ingestionName: data.ingestionName,
        gcsConfigType: data.gcsConfigType ?? currentGcsConfigType,
        dbtConfigSourceType: data.dbtConfigSourceType,
        dbtConfigSource: {
          ...data.dbtConfigSource,
          dbtClassificationName: data.dbtClassificationName,
          dbtUpdateDescriptions: data.dbtUpdateDescriptions,
          includeTags: data.includeTags,
        },
      }),
      [
        data.ingestionName,
        data.gcsConfigType,
        data.dbtConfigSourceType,
        data.dbtConfigSource,
        data.includeTags,
        currentGcsConfigType,
      ]
    );

  const getFields = () => {
    switch (currentDbtConfigSourceType) {
      case DBT_SOURCES.cloud: {
        return (
          <DBTCloudConfig
            dbtClassificationName={dbtConfigSource?.dbtClassificationName}
            dbtCloudAccountId={dbtConfigSource?.dbtCloudAccountId}
            dbtCloudAuthToken={dbtConfigSource?.dbtCloudAuthToken}
            dbtCloudJobId={dbtConfigSource?.dbtCloudJobId}
            dbtCloudProjectId={dbtConfigSource?.dbtCloudProjectId}
            dbtCloudUrl={dbtConfigSource.dbtCloudUrl}
            dbtUpdateDescriptions={dbtConfigSource?.dbtUpdateDescriptions}
            enableDebugLog={data.enableDebugLog}
            includeTags={dbtConfigSource?.includeTags}
          />
        );
      }
      case DBT_SOURCES.local: {
        return (
          <DBTLocalConfig
            dbtCatalogFilePath={dbtConfigSource?.dbtCatalogFilePath}
            dbtClassificationName={dbtConfigSource?.dbtClassificationName}
            dbtManifestFilePath={dbtConfigSource?.dbtManifestFilePath}
            dbtRunResultsFilePath={dbtConfigSource?.dbtRunResultsFilePath}
            dbtUpdateDescriptions={dbtConfigSource?.dbtUpdateDescriptions}
            enableDebugLog={data.enableDebugLog}
            includeTags={dbtConfigSource?.includeTags}
          />
        );
      }
      case DBT_SOURCES.http: {
        return (
          <DBTHttpConfig
            dbtCatalogHttpPath={dbtConfigSource?.dbtCatalogHttpPath}
            dbtClassificationName={dbtConfigSource?.dbtClassificationName}
            dbtManifestHttpPath={dbtConfigSource?.dbtManifestHttpPath}
            dbtRunResultsHttpPath={dbtConfigSource?.dbtRunResultsHttpPath}
            dbtUpdateDescriptions={dbtConfigSource?.dbtUpdateDescriptions}
            enableDebugLog={data.enableDebugLog}
            includeTags={dbtConfigSource?.includeTags}
          />
        );
      }
      case DBT_SOURCES.s3: {
        return (
          <DBTS3Config
            dbtClassificationName={dbtConfigSource?.dbtClassificationName}
            dbtPrefixConfig={dbtConfigSource?.dbtPrefixConfig}
            dbtSecurityConfig={dbtConfigSource?.dbtSecurityConfig}
            dbtUpdateDescriptions={dbtConfigSource?.dbtUpdateDescriptions}
            enableDebugLog={data.enableDebugLog}
            includeTags={dbtConfigSource?.includeTags}
          />
        );
      }
      case DBT_SOURCES.gcs: {
        return (
          <DBTGCSConfig
            dbtClassificationName={dbtConfigSource?.dbtClassificationName}
            dbtPrefixConfig={dbtConfigSource?.dbtPrefixConfig}
            dbtSecurityConfig={dbtConfigSource?.dbtSecurityConfig}
            dbtUpdateDescriptions={dbtConfigSource?.dbtUpdateDescriptions}
            enableDebugLog={data.enableDebugLog}
            gcsType={gcsConfigType}
            includeTags={dbtConfigSource?.includeTags}
          />
        );
      }
      default: {
        return (
          <span data-testid="dbt-source-none">
            {t('message.no-selected-dbt')}
          </span>
        );
      }
    }
  };

  const commonFields: FieldProp[] = [
    {
      name: 'name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        disabled: formType === FormSubmitType.EDIT,
        'data-testid': 'name',
      },
      id: 'root/name',
      helperText: t('message.instance-identifier'),
      formItemProps: {
        initialValue: ingestionName,
      },
    },
    {
      name: 'dbtConfigSource',
      id: 'root/dbtConfigSource',
      label: t('label.dbt-configuration-source'),
      type: FieldTypes.SELECT,
      props: {
        'data-testid': 'dbt-source',
        options: DBTSources,
      },
      required: false,
      formItemProps: {
        initialValue: dbtConfigSourceType,
      },
    },
  ];

  const handleFormSubmit: FormProps['onFinish'] = async (value) => {
    switch (currentDbtConfigSourceType) {
      case DBT_SOURCES.local:
        {
          onChange({
            dbtConfigSourceType: currentDbtConfigSourceType,
            dbtConfigSource: {
              dbtCatalogFilePath: value?.dbtCatalogFilePath,
              dbtManifestFilePath: value?.dbtManifestFilePath,
              dbtRunResultsFilePath: value?.dbtRunResultsFilePath,
              dbtUpdateDescriptions: value?.dbtUpdateDescriptions,
              dbtClassificationName: value?.dbtClassificationName,
              includeTags: value?.includeTags,
            },
            ingestionName: value?.name,
            enableDebugLog: value?.loggerLevel,
          });
          onSubmit();
        }

        break;

      case DBT_SOURCES.http:
        {
          onChange({
            dbtConfigSourceType: currentDbtConfigSourceType,
            dbtConfigSource: {
              dbtCatalogHttpPath: value?.dbtCatalogHttpPath,
              dbtManifestHttpPath: value?.dbtManifestHttpPath,
              dbtRunResultsHttpPath: value?.dbtRunResultsHttpPath,
              dbtUpdateDescriptions: value?.dbtUpdateDescriptions,
              dbtClassificationName: value?.dbtClassificationName,
              includeTags: value?.includeTags,
            },
            ingestionName: value?.name,
            enableDebugLog: value?.loggerLevel,
          });
          onSubmit();
        }

        break;
      case DBT_SOURCES.cloud:
        {
          onChange({
            dbtConfigSourceType: currentDbtConfigSourceType,
            dbtConfigSource: {
              dbtCloudAccountId: value?.dbtCloudAccountId,
              dbtCloudAuthToken: value?.dbtCloudAuthToken,
              dbtCloudProjectId: value?.dbtCloudProjectId,
              dbtCloudUrl: value?.dbtCloudUrl,
              dbtCloudJobId: value?.dbtCloudJobId,
              dbtUpdateDescriptions: value?.dbtUpdateDescriptions,
              dbtClassificationName: value?.dbtClassificationName,
              includeTags: value?.includeTags,
            },
            ingestionName: value?.name,
            enableDebugLog: value?.loggerLevel,
          });
          onSubmit();
        }

        break;
      case DBT_SOURCES.s3:
        {
          onChange({
            dbtConfigSourceType: currentDbtConfigSourceType,
            dbtConfigSource: {
              dbtSecurityConfig: {
                awsAccessKeyId: value?.awsAccessKeyId,
                awsSecretAccessKey: value?.awsSecretAccessKey,
                awsRegion: value?.awsRegion,
                awsSessionToken: value?.awsSessionToken,
                endPointURL: value?.endPointURL,
                profileName: value?.profileName,
                assumeRoleArn: value?.assumeRoleArn,
                assumeRoleSessionName: value?.assumeRoleSessionName,
                assumeRoleSourceIdentity: value?.assumeRoleSourceIdentity,
              },
              dbtPrefixConfig: {
                dbtBucketName: value?.dbtBucketName,
                dbtObjectPrefix: value?.dbtObjectPrefix,
              },
              dbtUpdateDescriptions: value?.dbtUpdateDescriptions,
              dbtClassificationName: value?.dbtClassificationName,
              includeTags: value?.includeTags,
            },
            ingestionName: value?.name,
            enableDebugLog: value?.loggerLevel,
          });
          onSubmit();
        }

        break;
      case DBT_SOURCES.gcs:
        {
          onChange({
            dbtConfigSourceType: currentDbtConfigSourceType,
            dbtConfigSource: {
              dbtSecurityConfig: {
                gcpConfig:
                  currentGcsConfigType === GCS_CONFIG.GCSValues
                    ? {
                        type: value?.type,
                        projectId: value?.projectId,
                        privateKeyId: value?.privateKeyId,
                        privateKey: value?.privateKey,
                        clientEmail: value?.clientEmail,
                        clientId: value?.clientId,
                        authUri: value?.authUri,
                        tokenUri: value?.tokenUri,
                        authProviderX509CertUrl: value?.authProviderX509CertUrl,
                        clientX509CertUrl: value?.clientX509CertUrl,
                      }
                    : value?.gcpCredentialsPath,
              },
              dbtPrefixConfig: {
                dbtBucketName: value?.dbtBucketName,
                dbtObjectPrefix: value?.dbtObjectPrefix,
              },
              dbtUpdateDescriptions: value?.dbtUpdateDescriptions,
              dbtClassificationName: value?.dbtClassificationName,
              includeTags: value?.includeTags,
            },
            ingestionName: value?.name,
            enableDebugLog: value?.loggerLevel,
          });
          onSubmit();
        }

        break;

      default:
        onSubmit();

        break;
    }
  };

  return (
    <Form
      className="p-x-xs configure-ingestion-form"
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}
      onFocus={(e) => onFocus(e.target.id)}>
      {generateFormFields(commonFields)}
      {getFields()}
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
          htmlType="submit"
          type="primary">
          {okText}
        </Button>
      </Space>
    </Form>
  );
};

export default DBTConfigFormBuilder;
