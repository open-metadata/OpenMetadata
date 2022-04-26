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

import { LoadingState } from 'Models';
import React, { Fragment, FunctionComponent, useState } from 'react';
import {
  DbtConfigSource,
  GCSCredentialsValues,
  SCredentials,
} from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import { DropDownListItem } from '../../dropdown/types';
import { Field } from '../../Field/Field';
import { DBTGCSConfig } from './ DBTGCSConfig';
import { DBTHttpConfig } from './ DBTHttpConfig';
import { DBTLocalConfig } from './ DBTLocalConfig';
import { DBTS3Config } from './ DBTS3Config';

interface Props {
  okText: string;
  cancelText: string;
  data?: DbtConfigSource;
  status?: LoadingState;
  onCancel: () => void;
  onSubmit: (data?: DbtConfigSource) => void;
}

enum DBT_SOURCES {
  local = 'local',
  http = 'http',
  s3 = 's3',
  gcs = 'gcs',
}

const DBTSources: Array<DropDownListItem> = [
  {
    name: 'None',
    value: '',
  },
  {
    name: 'DBT Local Config Source',
    value: DBT_SOURCES.local,
  },
  {
    name: 'DBT HTTP Config Source',
    value: DBT_SOURCES.http,
  },
  {
    name: 'DBT S3 Config Source',
    value: DBT_SOURCES.s3,
  },
  {
    name: 'DBT GCS Config Source',
    value: DBT_SOURCES.gcs,
  },
];

type GCSCredentialsErrors = Record<keyof GCSCredentialsValues, boolean>;
type SCredentialsErrors = Record<
  keyof SCredentials,
  boolean | GCSCredentialsErrors
>;
type DbtConfigSourceErrors = Record<
  keyof DbtConfigSource,
  boolean | SCredentialsErrors
>;

const DBTConfigFormBuilder: FunctionComponent<Props> = ({
  data = {},
  okText,
  cancelText,
  onCancel,
  onSubmit,
}: Props) => {
  const [dbtConfig, setDbtConfig] = useState<DbtConfigSource>(data);
  const [dbtSource, setDbtSource] = useState<DBT_SOURCES>('' as DBT_SOURCES);
  /* eslint-disable-next-line */
  const [showError, setShowError] = useState<DbtConfigSourceErrors>(
    {} as DbtConfigSourceErrors
  );

  const updateDbtConfig = (
    key: keyof DbtConfigSource,
    val: string | SCredentials
  ) => {
    setDbtConfig((pre) => ({ ...pre, [key]: val }));
  };

  const validateDBTConfig = () => {
    switch (dbtSource) {
      case DBT_SOURCES.local: {
        return;
      }
      case DBT_SOURCES.http: {
        return;
      }
      case DBT_SOURCES.s3: {
        return;
      }
      case DBT_SOURCES.gcs: {
        return;
      }
      default: {
        return true;
      }
    }
  };

  const handleSubmit = () => {
    if (dbtSource) {
      validateDBTConfig();
      onSubmit(dbtConfig);
    } else {
      onSubmit();
    }
  };

  const getLocalConfigFields = () => {
    return (
      <DBTLocalConfig
        dbtCatalogFilePath={dbtConfig.dbtCatalogFilePath}
        dbtManifestFilePath={dbtConfig.dbtManifestFilePath}
        handleCatalogFilePathChange={(val) => {
          updateDbtConfig('dbtCatalogFilePath', val);
        }}
        handleManifestFilePathChange={(val) => {
          updateDbtConfig('dbtManifestFilePath', val);
        }}
      />
    );
  };

  const getHttpConfigFields = () => {
    return (
      <DBTHttpConfig
        dbtCatalogHttpPath={dbtConfig.dbtCatalogFilePath}
        dbtManifestHttpPath={dbtConfig.dbtManifestFilePath}
        handleCatalogHttpPathChange={(val) => {
          updateDbtConfig('dbtCatalogHttpPath', val);
        }}
        handleManifestHttpPathChange={(val) => {
          updateDbtConfig('dbtManifestHttpPath', val);
        }}
      />
    );
  };

  const getS3ConfigFields = () => {
    return (
      <DBTS3Config
        dbtSecurityConfig={dbtConfig.dbtSecurityConfig}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
        }}
      />
    );
  };

  const getGCSConfigFields = () => {
    return (
      <DBTGCSConfig
        dbtSecurityConfig={dbtConfig.dbtSecurityConfig}
        handleSecurityConfigChange={(val) => {
          updateDbtConfig('dbtSecurityConfig', val);
        }}
      />
    );
  };

  const getFields = () => {
    switch (dbtSource) {
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
        return <Fragment />;
      }
    }
  };

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
          value={dbtSource}
          onChange={(e) => setDbtSource(e.target.value as DBT_SOURCES)}>
          {DBTSources.map((option, i) => (
            <option key={i} value={option.value}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>
      {dbtSource && getSeparator('')}
      {getFields()}
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
          onClick={handleSubmit}>
          <span>{okText}</span>
        </Button>
      </Field>
    </Fragment>
  );
};

export default DBTConfigFormBuilder;
