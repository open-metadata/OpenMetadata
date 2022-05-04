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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
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
  gcsConfig: {},
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
    .mockImplementation(({ handleSecurityConfigChange }) => (
      <div
        data-testid="dbt-s3"
        onClick={() => {
          handleSecurityConfigChange(mockSecurityConfigS3);
        }}>
        DBT S3 Config
      </div>
    )),
}));

jest.mock('./DBTGCSConfig', () => ({
  DBTGCSConfig: jest
    .fn()
    .mockImplementation(
      ({ handleSecurityConfigChange, handleGcsTypeChange }) => (
        <div
          data-testid="dbt-gcs"
          onClick={() => {
            handleSecurityConfigChange(mockSecurityConfigS3);
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
const mockCatalogChange = jest.fn();
const mockManifestChange = jest.fn();

const mockProps = {
  data: mockData,
  okText: 'Next',
  cancelText: 'Back',
  gcsType: GCS_CONFIG.GCSValues,
  handleGcsTypeChange: mockCatalogChange,
  handleSourceChange: mockManifestChange,
  onCancel: mockCancel,
  onSubmit: mockSubmit,
};

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
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.local} />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtLocal = getByTestId(container, 'dbt-local');

    expect(selectSource).toBeInTheDocument();
    expect(dbtLocal).toBeInTheDocument();
  });

  it('Form should render with http dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.http} />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtHttp = getByTestId(container, 'dbt-http');

    expect(selectSource).toBeInTheDocument();
    expect(dbtHttp).toBeInTheDocument();
  });

  it('Form should render with s3 dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.s3} />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtS3 = getByTestId(container, 'dbt-s3');

    expect(selectSource).toBeInTheDocument();
    expect(dbtS3).toBeInTheDocument();
  });

  it('Form should render with gcs dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.gcs} />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtGCS = getByTestId(container, 'dbt-gcs');

    expect(selectSource).toBeInTheDocument();
    expect(dbtGCS).toBeInTheDocument();
  });

  it('Form should render with no dbt source', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={'' as DBT_SOURCES} />
    );
    const selectSource = getByTestId(container, 'dbt-source');
    const dbtNone = getByTestId(container, 'dbt-source-none');

    expect(selectSource).toBeInTheDocument();
    expect(dbtNone).toBeInTheDocument();
  });

  it('should change dbt local fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.local} />
    );
    const dbtLocal = getByTestId(container, 'dbt-local');

    fireEvent.click(dbtLocal);

    expect(dbtLocal).toBeInTheDocument();
  });

  it('should change dbt http fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.http} />
    );
    const dbtHttp = getByTestId(container, 'dbt-http');

    fireEvent.click(dbtHttp);

    expect(dbtHttp).toBeInTheDocument();
  });

  it('should change dbt s3 fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.s3} />
    );
    const dbtS3 = getByTestId(container, 'dbt-s3');

    fireEvent.click(dbtS3);

    expect(dbtS3).toBeInTheDocument();
  });

  it('should change dbt gcs fields', async () => {
    const { container } = render(
      <DBTConfigFormBuilder {...mockProps} source={DBT_SOURCES.gcs} />
    );
    const dbtGCS = getByTestId(container, 'dbt-gcs');

    fireEvent.click(dbtGCS);
    fireEvent.mouseDown(dbtGCS);

    expect(dbtGCS).toBeInTheDocument();
  });
});
