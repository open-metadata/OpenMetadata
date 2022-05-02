/*
 *  Copyright 2021 Collate
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

import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import {
  DbtConfigSource,
  SCredentials,
} from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
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
  source = '' as DBT_SOURCES,
  handleGcsTypeChange,
  handleSourceChange,
  onCancel,
  onSubmit,
}: DBTConfigFormProps) => {
  const [dbtConfig, setDbtConfig] = useState<DbtConfigSource>(data);

  const updateDbtConfig = (
    key: keyof DbtConfigSource,
    val?: string | SCredentials
  ) => {
    setDbtConfig((pre) => {
      return { ...pre, [key]: val };
    });
  };

  const getLocalConfigFields = () => {
    return (
      <DBTLocalConfig
        cancelText={cancelText}
        dbtCatalogFilePath={dbtConfig.dbtCatalogFilePath}
        dbtManifestFilePath={dbtConfig.dbtManifestFilePath}
        handleCatalogFilePathChange={(val) => {
          updateDbtConfig('dbtCatalogFilePath', val);
        }}
        handleManifestFilePathChange={(val) => {
          updateDbtConfig('dbtManifestFilePath', val);
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
        handleCatalogHttpPathChange={(val) => {
          updateDbtConfig('dbtCatalogHttpPath', val);
        }}
        handleManifestHttpPathChange={(val) => {
          updateDbtConfig('dbtManifestHttpPath', val);
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
        dbtSecurityConfig={dbtConfig.dbtSecurityConfig}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
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
        dbtSecurityConfig={dbtConfig.dbtSecurityConfig}
        gcsType={gcsType}
        handleGcsTypeChange={(type) => {
          handleGcsTypeChange && handleGcsTypeChange(type);
          setDbtConfig(data);
        }}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
        }}
        okText={okText}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  };

  const getFields = () => {
    switch (source) {
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
            No source selected for DBT Configuration.
            {getSeparator('')}
            <Field className="tw-flex tw-justify-end">
              <Button
                className="tw-mr-2"
                data-testid="back-button"
                size="regular"
                theme="primary"
                variant="text"
                onClick={onCancel}>
                <span>{cancelText}</span>
              </Button>

              <Button
                data-testid="submit-btn"
                size="regular"
                theme="primary"
                variant="contained"
                onClick={() => onSubmit()}>
                <span>{okText}</span>
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
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="dbt-source">
          DBT Configuration Source
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          Available sources to fetch DBT catalog and manifest files.
        </p>
        <select
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="dbt-source"
          id="dbt-source"
          name="dbt-source"
          placeholder="Select DBT Source"
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
