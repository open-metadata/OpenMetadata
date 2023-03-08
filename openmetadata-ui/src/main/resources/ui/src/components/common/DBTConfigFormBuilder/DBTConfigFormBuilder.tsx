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

import { Button, Input, Select } from 'antd';
import React, {
  Fragment,
  FunctionComponent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FormSubmitType } from '../../../enums/form.enum';
import {
  DBTBucketDetails,
  SCredentials,
} from '../../../generated/metadataIngestion/dbtPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import { ModifiedDbtConfig } from '../../AddIngestion/addIngestion.interface';
import { Field } from '../../Field/Field';
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
}: DBTConfigFormProps) => {
  const { t } = useTranslation();
  //   const [dbtConfig, setDbtConfig] = useState<ModifiedDbtConfig>(data);

  const { dbtConfigSource, gcsConfigType, ingestionName, dbtConfigSourceType } =
    useMemo(
      () => ({
        ingestionName: data.ingestionName,
        gcsConfigType: data.gcsConfigType,
        dbtConfigSourceType: data.dbtConfigSourceType,
        dbtConfigSource: {
          ...data.dbtConfigSource,
          dbtClassificationName: data.dbtClassificationName,
          dbtUpdateDescriptions: data.dbtUpdateDescriptions,
        },
      }),
      [
        data.ingestionName,
        data.gcsConfigType,
        data.dbtConfigSourceType,
        data.dbtConfigSource,
      ]
    );

  const [dbtConfig, setDbtConfig] =
    useState<ModifiedDbtConfig>(dbtConfigSource);

  const updateDbtConfig = (
    key: keyof ModifiedDbtConfig,
    val?: string | boolean | SCredentials | DBTBucketDetails
  ) => {
    setDbtConfig((pre) => {
      return { ...pre, [key]: val };
    });
  };

  const getCloudConfigFields = () => {
    return (
      <DBTCloudConfig
        cancelText={cancelText}
        dbtClassificationName={dbtConfig?.dbtClassificationName}
        dbtCloudAccountId={dbtConfig?.dbtCloudAccountId}
        dbtCloudAuthToken={dbtConfig?.dbtCloudAuthToken}
        dbtCloudJobId={dbtConfig?.dbtCloudJobId}
        dbtCloudProjectId={dbtConfig?.dbtCloudProjectId}
        dbtCloudUrl={dbtConfig.dbtCloudUrl}
        dbtUpdateDescriptions={dbtConfig?.dbtUpdateDescriptions}
        handleCloudAccountIdChange={(val) => {
          updateDbtConfig('dbtCloudAccountId', val);
        }}
        handleCloudAuthTokenChange={(val) => {
          updateDbtConfig('dbtCloudAuthToken', val);
        }}
        handleDbtCloudJobId={(val) => {
          updateDbtConfig('dbtCloudJobId', val);
        }}
        handleDbtCloudProjectId={(val) => {
          updateDbtConfig('dbtCloudProjectId', val);
        }}
        handleDbtCloudUrl={(val) => updateDbtConfig('dbtCloudUrl', val)}
        handleUpdateDBTClassification={(val) => {
          updateDbtConfig('dbtClassificationName', val);
        }}
        handleUpdateDescriptions={(val) => {
          updateDbtConfig('dbtUpdateDescriptions', val);
        }}
        okText={okText}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  };

  const getLocalConfigFields = () => {
    return (
      <DBTLocalConfig
        cancelText={cancelText}
        dbtCatalogFilePath={dbtConfig?.dbtCatalogFilePath}
        dbtClassificationName={dbtConfig?.dbtClassificationName}
        dbtManifestFilePath={dbtConfig?.dbtManifestFilePath}
        dbtRunResultsFilePath={dbtConfig?.dbtRunResultsFilePath}
        dbtUpdateDescriptions={dbtConfig?.dbtUpdateDescriptions}
        handleCatalogFilePathChange={(val) => {
          updateDbtConfig('dbtCatalogFilePath', val);
        }}
        handleManifestFilePathChange={(val) => {
          updateDbtConfig('dbtManifestFilePath', val);
        }}
        handleRunResultsFilePathChange={(val) => {
          updateDbtConfig('dbtRunResultsFilePath', val);
        }}
        handleUpdateDBTClassification={(val) => {
          updateDbtConfig('dbtClassificationName', val);
        }}
        handleUpdateDescriptions={(val) => {
          updateDbtConfig('dbtUpdateDescriptions', val);
        }}
        okText={okText}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  };

  const getHttpConfigFields = () => {
    return (
      <DBTHttpConfig
        cancelText={cancelText}
        dbtCatalogHttpPath={dbtConfig?.dbtCatalogHttpPath}
        dbtClassificationName={dbtConfig?.dbtClassificationName}
        dbtManifestHttpPath={dbtConfig?.dbtManifestHttpPath}
        dbtRunResultsHttpPath={dbtConfig?.dbtRunResultsHttpPath}
        dbtUpdateDescriptions={dbtConfig?.dbtUpdateDescriptions}
        handleCatalogHttpPathChange={(val) => {
          updateDbtConfig('dbtCatalogHttpPath', val);
        }}
        handleManifestHttpPathChange={(val) => {
          updateDbtConfig('dbtManifestHttpPath', val);
        }}
        handleRunResultsHttpPathChange={(val) => {
          updateDbtConfig('dbtRunResultsHttpPath', val);
        }}
        handleUpdateDBTClassification={(val) => {
          updateDbtConfig('dbtClassificationName', val);
        }}
        handleUpdateDescriptions={(val) => {
          updateDbtConfig('dbtUpdateDescriptions', val);
        }}
        okText={okText}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  };

  const getS3ConfigFields = () => {
    return (
      <DBTS3Config
        cancelText={cancelText}
        dbtClassificationName={dbtConfig?.dbtClassificationName}
        dbtPrefixConfig={dbtConfig?.dbtPrefixConfig}
        dbtSecurityConfig={dbtConfig?.dbtSecurityConfig}
        dbtUpdateDescriptions={dbtConfig?.dbtUpdateDescriptions}
        handlePrefixConfigChange={(val) => {
          updateDbtConfig('dbtPrefixConfig', val);
        }}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
        }}
        handleUpdateDBTClassification={(val) => {
          updateDbtConfig('dbtClassificationName', val);
        }}
        handleUpdateDescriptions={(val) => {
          updateDbtConfig('dbtUpdateDescriptions', val);
        }}
        okText={okText}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  };

  const handleGcsTypeChange = (type: GCS_CONFIG) =>
    onChange({
      gcsConfigType: type,
    });

  const handleOnchange = (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({
      ingestionName: event.target.value,
    });

  const handleDbtConfigSourceType = (value: DBT_SOURCES) => {
    onChange({
      dbtConfigSourceType: value as DBT_SOURCES,
    });
  };

  const getGCSConfigFields = () => {
    return (
      <DBTGCSConfig
        cancelText={cancelText}
        dbtClassificationName={dbtConfig?.dbtClassificationName}
        dbtPrefixConfig={dbtConfig?.dbtPrefixConfig}
        dbtSecurityConfig={dbtConfig?.dbtSecurityConfig}
        dbtUpdateDescriptions={dbtConfig?.dbtUpdateDescriptions}
        gcsType={gcsConfigType}
        handleGcsTypeChange={handleGcsTypeChange}
        handlePrefixConfigChange={(val) => {
          updateDbtConfig('dbtPrefixConfig', val);
        }}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
        }}
        handleUpdateDBTClassification={(val) => {
          updateDbtConfig('dbtClassificationName', val);
        }}
        handleUpdateDescriptions={(val) => {
          updateDbtConfig('dbtUpdateDescriptions', val);
        }}
        okText={okText}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  };

  const getFields = () => {
    switch (dbtConfigSourceType) {
      case DBT_SOURCES.cloud: {
        return getCloudConfigFields();
      }
      case DBT_SOURCES.local: {
        return getLocalConfigFields();
      }
      case DBT_SOURCES.http: {
        return getHttpConfigFields();
      }
      case DBT_SOURCES.s3: {
        return getS3ConfigFields();
      }
      case DBT_SOURCES.gcs: {
        return getGCSConfigFields();
      }
      default: {
        return (
          <Fragment>
            <span data-testid="dbt-source-none">
              {t('message.no-selected-dbt')}
            </span>
            {getSeparator('')}
            <Field className="tw-flex tw-justify-end">
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
                onClick={() => onSubmit()}>
                {okText}
              </Button>
            </Field>
          </Fragment>
        );
      }
    }
  };

  useEffect(() => {
    setDbtConfig(dbtConfigSource);
  }, [data, dbtConfigSourceType, gcsConfigType]);

  return (
    <Fragment>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
          {t('label.name')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.instance-identifier')}
        </p>
        <Input
          className="w-full"
          data-testid="profile-sample"
          disabled={formType === FormSubmitType.EDIT}
          id="name"
          name="name"
          value={ingestionName}
          onChange={handleOnchange}
        />
        {getSeparator('')}
      </Field>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="dbt-source">
          {t('label.dbt-configuration-source')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.fetch-dbt-files')}
        </p>
        <Select
          className="w-full"
          data-testid="dbt-source"
          id="dbt-source"
          options={DBTSources}
          placeholder={t('label.select-field', {
            field: t('label.dbt-source'),
          })}
          value={dbtConfigSourceType}
          onChange={handleDbtConfigSourceType}
        />
      </Field>
      {getSeparator('')}
      {getFields()}
    </Fragment>
  );
};

export default DBTConfigFormBuilder;
