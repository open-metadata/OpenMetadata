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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { FormSubmitType } from '../../../enums/form.enum';
import { AddIngestionState } from '../../AddIngestion/addIngestion.interface';
import { DBTConfigFormProps } from './DBTConfigForm.interface';
import DBTConfigFormBuilder from './DBTConfigFormBuilder';
import { DBT_SOURCES, GCS_CONFIG } from './DBTFormEnum';

const mockSecurityConfigS3 = {
  awsAccessKeyId: 'awsAccessKeyId',
  awsSecretAccessKey: 'awsSecretAccessKey',
  awsRegion: 'awsRegion',
  awsSessionToken: 'awsSessionToken',
  endPointURL: 'endPointURL',
};

const mockSecurityConfigGCSValue = {
  gcsConfig: {
    authProviderX509CertUrl: 'url',

    authUri: 'uri',

    clientEmail: 'email',

    clientId: 'id',

    clientX509CertUrl: 'certUrl',

    privateKey: 'privateKey',

    privateKeyId: 'keyId',

    projectId: 'projectId',

    tokenUri: 'tokenUri',

    type: 'type',
  },
};

const mockPrefixConfig = {
  dbtBucketName: 'Test Bucket',
  dbtObjectPrefix: 'Test Prefix',
};

// const mockSecurityConfigGCSPath = {
//   gcsConfig: 'gcsConfigPath',
// };

const mockData = {
  dbtCatalogFilePath: 'CatalogFile',
  dbtManifestFilePath: 'ManifestFile',
  dbtCatalogHttpPath: 'CatalogHttp',
  dbtManifestHttpPath: 'ManifestHttp',
  dbtSecurityConfig: {
    ...mockSecurityConfigS3,
    ...mockSecurityConfigGCSValue,
  },
  dbtPrefixConfig: mockPrefixConfig,
};

jest.mock('./DBTLocalConfig', () => ({
  DBTLocalConfig: jest
    .fn()
    .mockImplementation(
      ({ handleCatalogFilePathChange, handleManifestFilePathChange }) => (
        <div
          data-testid="dbt-local"
          onClick={() => {
            handleCatalogFilePathChange(mockData.dbtCatalogFilePath);
            handleManifestFilePathChange(mockData.dbtManifestFilePath);
          }}>
          DBT Local Config
        </div>
      )
    ),
}));

jest.mock('./DBTHttpConfig', () => ({
  DBTHttpConfig: jest
    .fn()
    .mockImplementation(
      ({ handleCatalogHttpPathChange, handleManifestHttpPathChange }) => (
        <div
          data-testid="dbt-http"
          onClick={() => {
            handleCatalogHttpPathChange(mockData.dbtCatalogHttpPath);
            handleManifestHttpPathChange(mockData.dbtManifestHttpPath);
          }}>
          DBT Http Config
        </div>
      )
    ),
}));

jest.mock('./DBTS3Config', () => ({
  DBTS3Config: jest
    .fn()
    .mockImplementation(
      ({ handleSecurityConfigChange, handlePrefixConfigChange }) => (
        <div
          data-testid="dbt-s3"
          onClick={() => {
            handleSecurityConfigChange(mockSecurityConfigS3);
            handlePrefixConfigChange(mockPrefixConfig);
          }}>
          DBT S3 Config
        </div>
      )
    ),
}));

jest.mock('./DBTGCSConfig', () => ({
  DBTGCSConfig: jest
    .fn()
    .mockImplementation(
      ({
        handleSecurityConfigChange,
        handlePrefixConfigChange,
        handleGcsTypeChange,
      }) => (
        <div
          data-testid="dbt-gcs"
          onClick={() => {
            handleSecurityConfigChange(mockSecurityConfigS3);
            handlePrefixConfigChange(mockPrefixConfig);
          }}
          onMouseDown={() => {
            handleGcsTypeChange(GCS_CONFIG.GCSValues);
          }}>
          DBT GCS Config
        </div>
      )
    ),
}));

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockIngestionName = jest.fn();
const mockOnChange = jest.fn();

const mockState = {
  dbtConfigSource: '',
  dbtConfigSourceType: DBT_SOURCES.local,
  ingestionName: i18n.t('label.dbt-lowercase'),
  gcsConfigType: GCS_CONFIG.GCSValues,
} as unknown as AddIngestionState;

const mockProps = {
  data: mockState,
  okText: i18n.t('label.next'),
  cancelText: i18n.t('label.cancel'),
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  formType: FormSubmitType.ADD,
  handleIngestionName: mockIngestionName,
  onChange: mockOnChange,
} as DBTConfigFormProps;

describe('Test DBT Config Form Builder', () => {
  it('Form should render with default dbt source', async () => {
    const { container } = render(<DBTConfigFormBuilder {...mockProps} />);
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtLocal = getByTestId(container, 'dbt-local');

    expect(selectSource).toBeInTheDocument();
    expect(dbtLocal).toBeInTheDocument();
  });

  it('Form should render with local dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.local,
          } as AddIngestionState
        }
      />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtLocal = getByTestId(container, 'dbt-local');

    expect(selectSource).toBeInTheDocument();
    expect(dbtLocal).toBeInTheDocument();
  });

  it('Form should render with http dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.http,
          } as AddIngestionState
        }
      />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtHttp = getByTestId(container, 'dbt-http');

    expect(selectSource).toBeInTheDocument();
    expect(dbtHttp).toBeInTheDocument();
  });

  it('Form should render with s3 dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.s3,
          } as AddIngestionState
        }
      />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtS3 = getByTestId(container, 'dbt-s3');

    expect(selectSource).toBeInTheDocument();
    expect(dbtS3).toBeInTheDocument();
  });

  it('Form should render with gcs dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.gcs,
          } as AddIngestionState
        }
      />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtGCS = getByTestId(container, 'dbt-gcs');

    expect(selectSource).toBeInTheDocument();
    expect(dbtGCS).toBeInTheDocument();
  });

  it('Form should render with no dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: '' as DBT_SOURCES,
          } as AddIngestionState
        }
      />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtNone = getByTestId(container, 'dbt-source-none');

    expect(selectSource).toBeInTheDocument();
    expect(dbtNone).toBeInTheDocument();
  });

  it('should change dbt local fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.local,
          } as AddIngestionState
        }
      />
    );
    const dbtLocal = getByTestId(container, 'dbt-local');

    fireEvent.click(dbtLocal);

    expect(dbtLocal).toBeInTheDocument();
  });

  it('should change dbt http fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.http,
          } as AddIngestionState
        }
      />
    );
    const dbtHttp = getByTestId(container, 'dbt-http');

    fireEvent.click(dbtHttp);

    expect(dbtHttp).toBeInTheDocument();
  });

  it('should change dbt s3 fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.s3,
          } as AddIngestionState
        }
      />
    );
    const dbtS3 = getByTestId(container, 'dbt-s3');

    fireEvent.click(dbtS3);

    expect(dbtS3).toBeInTheDocument();
  });

  it('should change dbt gcs fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder
        {...mockProps}
        data={
          {
            dbtConfigSourceType: DBT_SOURCES.gcs,
          } as AddIngestionState
        }
      />
    );
    const dbtGCS = getByTestId(container, 'dbt-gcs');

    fireEvent.click(dbtGCS);
    fireEvent.mouseDown(dbtGCS);

    expect(dbtGCS).toBeInTheDocument();
  });
});
