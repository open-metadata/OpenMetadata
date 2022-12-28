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

import { Button } from 'antd';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormSubmitType } from '../../../enums/form.enum';
import {
  DBTBucketDetails,
  DbtConfig,
  SCredentials,
} from '../../../generated/metadataIngestion/dbtPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import { Field } from '../../Field/Field';
import { DBTCloudConfig } from './DBTCloudConfig';
import { DBTConfigFormProps } from './DBTConfigForm.interface';
import { DBTSources } from './DBTFormConstants';
import { DBT_SOURCES } from './DBTFormEnum';
import { DBTGCSConfig } from './DBTGCSConfig';
import { DBTHttpConfig } from './DBTHttpConfig';
import { DBTLocalConfig } from './DBTLocalConfig';
import { DBTS3Config } from './DBTS3Config';

const DBTConfigFormBuilder: FunctionComponent<DBTConfigFormProps> = ({
  data,
  okText,
  cancelText,
  gcsType,
  source = DBT_SOURCES.local,
  handleGcsTypeChange,
  handleSourceChange,
  onCancel,
  onSubmit,
  formType,
  ingestionName,
  handleIngestionName,
}: DBTConfigFormProps) => {
  const { t } = useTranslation();
  const [dbtConfig, setDbtConfig] = useState<DbtConfig>(data);

  const updateDbtConfig = (
    key: keyof DbtConfig,
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
        dbtCloudAccountId={dbtConfig.dbtCloudAccountId}
        dbtCloudAuthToken={dbtConfig.dbtCloudAuthToken}
        dbtCloudProjectId={dbtConfig.dbtCloudProjectId}
        dbtUpdateDescriptions={dbtConfig.dbtUpdateDescriptions}
        handleCloudAccountIdChange={(val) => {
          updateDbtConfig('dbtCloudAccountId', val);
        }}
        handleCloudAuthTokenChange={(val) => {
          updateDbtConfig('dbtCloudAuthToken', val);
        }}
        handleDbtCloudProjectId={(val) => {
          updateDbtConfig('dbtCloudProjectId', val);
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
        dbtCatalogFilePath={dbtConfig.dbtCatalogFilePath}
        dbtManifestFilePath={dbtConfig.dbtManifestFilePath}
        dbtRunResultsFilePath={dbtConfig.dbtRunResultsFilePath}
        dbtUpdateDescriptions={dbtConfig.dbtUpdateDescriptions}
        handleCatalogFilePathChange={(val) => {
          updateDbtConfig('dbtCatalogFilePath', val);
        }}
        handleManifestFilePathChange={(val) => {
          updateDbtConfig('dbtManifestFilePath', val);
        }}
        handleRunResultsFilePathChange={(val) => {
          updateDbtConfig('dbtRunResultsFilePath', val);
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
        dbtCatalogHttpPath={dbtConfig.dbtCatalogHttpPath}
        dbtManifestHttpPath={dbtConfig.dbtManifestHttpPath}
        dbtRunResultsHttpPath={dbtConfig.dbtRunResultsHttpPath}
        dbtUpdateDescriptions={dbtConfig.dbtUpdateDescriptions}
        handleCatalogHttpPathChange={(val) => {
          updateDbtConfig('dbtCatalogHttpPath', val);
        }}
        handleManifestHttpPathChange={(val) => {
          updateDbtConfig('dbtManifestHttpPath', val);
        }}
        handleRunResultsHttpPathChange={(val) => {
          updateDbtConfig('dbtRunResultsHttpPath', val);
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
        dbtPrefixConfig={dbtConfig.dbtPrefixConfig}
        dbtSecurityConfig={dbtConfig.dbtSecurityConfig}
        dbtUpdateDescriptions={dbtConfig.dbtUpdateDescriptions}
        handlePrefixConfigChange={(val) => {
          updateDbtConfig('dbtPrefixConfig', val);
        }}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
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

  const getGCSConfigFields = () => {
    return (
      <DBTGCSConfig
        cancelText={cancelText}
        dbtPrefixConfig={dbtConfig.dbtPrefixConfig}
        dbtSecurityConfig={dbtConfig.dbtSecurityConfig}
        dbtUpdateDescriptions={dbtConfig.dbtUpdateDescriptions}
        gcsType={gcsType}
        handleGcsTypeChange={(type) => {
          handleGcsTypeChange && handleGcsTypeChange(type);
        }}
        handlePrefixConfigChange={(val) => {
          updateDbtConfig('dbtPrefixConfig', val);
        }}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
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
    switch (source) {
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
              {t('label.no-selected-dbt')}
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
    setDbtConfig(data);
  }, [data, source, gcsType]);

  return (
    <Fragment>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
          {t('label.name')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.instance-identifier')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="name"
          disabled={formType === FormSubmitType.EDIT}
          id="name"
          name="name"
          type="text"
          value={ingestionName}
          onChange={(e) => handleIngestionName(e.target.value)}
        />
        {getSeparator('')}
      </Field>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="dbt-source">
          {t('label.dbt-Configuration-source')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.fetch-dbt-files')}
        </p>
        <select
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbt-source"
          id="dbt-source"
          name="dbt-source"
          placeholder={t('label.select-dbt-source')}
          value={source}
          onChange={(e) => {
            handleSourceChange &&
              handleSourceChange(e.target.value as DBT_SOURCES);
          }}>
          {DBTSources.map((option, i) => (
            <option key={i} value={option.value}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>
      {getSeparator('')}
      {getFields()}
    </Fragment>
  );
};

export default DBTConfigFormBuilder;
