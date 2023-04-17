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
import {
  DBTBucketDetails,
  SCredentials,
} from 'generated/metadataIngestion/dbtPipeline';
import React from 'react';
import { GCS_CONFIG } from './DBTFormEnum';
import { DBTGCSConfig } from './DBTGCSConfig';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockPrefixConfigChange = jest.fn();
const mockSecurityConfigChange = jest.fn();
const mockUpdateDescriptions = jest.fn();
const mockUpdateDBTClassification = jest.fn();
const mockHandleEnableDebugLogCheck = jest.fn();
const mockIncludeTagsClick = jest.fn();

const gsConfig = {
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
};

const mockProps = {
  okText: 'Next',
  cancelText: 'Back',
  gcsType: GCS_CONFIG.GCSValues,
  dbtUpdateDescriptions: false,
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handlePrefixConfigChange: mockPrefixConfigChange,
  handleSecurityConfigChange: mockSecurityConfigChange,
  handleUpdateDescriptions: mockUpdateDescriptions,
  handleIncludeTagsClick: mockIncludeTagsClick,
  handleUpdateDBTClassification: mockUpdateDBTClassification,
  enableDebugLog: false,
  handleEnableDebugLogCheck: mockHandleEnableDebugLogCheck,
  dbtClassificationName: '',
  dbtSecurityConfig: {} as SCredentials,
  dbtPrefixConfig: {} as DBTBucketDetails,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT GCS Config Form', () => {
  it('Fields should render for gcs values', async () => {
    const { container } = render(<DBTGCSConfig {...mockProps} />);
    const selectGcsConfig = getByTestId(container, 'gcs-config');
    const inputCredsType = getByTestId(container, 'credential-type');
    const inputProjId = getByTestId(container, 'project-id');
    const inputPrivateKeyId = getByTestId(container, 'private-key-id');
    const inputPrivateKey = getByTestId(container, 'private-key');
    const inputClientEmail = getByTestId(container, 'client-email');
    const inputClientId = getByTestId(container, 'client-id');
    const inputAuthUri = getByTestId(container, 'auth-uri');
    const inputTokenUri = getByTestId(container, 'token-uri');
    const inputAuthCertUri = getByTestId(
      container,
      'auth-x509-certificate-uri'
    );
    const inputClientCertUri = getByTestId(
      container,
      'client-x509-certificate-uri'
    );
    const inputBucketName = getByTestId(container, 'dbt-bucket-name');
    const inputObjPrefix = getByTestId(container, 'dbt-object-prefix');

    expect(selectGcsConfig).toBeInTheDocument();
    expect(inputCredsType).toBeInTheDocument();
    expect(inputProjId).toBeInTheDocument();
    expect(inputPrivateKeyId).toBeInTheDocument();
    expect(inputPrivateKey).toBeInTheDocument();
    expect(inputClientEmail).toBeInTheDocument();
    expect(inputClientId).toBeInTheDocument();
    expect(inputAuthUri).toBeInTheDocument();
    expect(inputTokenUri).toBeInTheDocument();
    expect(inputAuthCertUri).toBeInTheDocument();
    expect(inputClientCertUri).toBeInTheDocument();
    expect(inputBucketName).toBeInTheDocument();
    expect(inputObjPrefix).toBeInTheDocument();
  });

  it('Fields should render for gcs credential path', async () => {
    const { container } = render(
      <DBTGCSConfig {...mockProps} gcsType={GCS_CONFIG.GCSCredentialsPath} />
    );
    const selectGcsConfig = getByTestId(container, 'gcs-config');
    const inputCredsPath = getByTestId(container, 'gcs-cred-path');

    expect(selectGcsConfig).toBeInTheDocument();
    expect(inputCredsPath).toBeInTheDocument();
  });

  it('credential-type should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: {
            ...gsConfig,
            type: 'CredsType',
          },
        }}
      />
    );
    const inputCredsType = getByTestId(container, 'credential-type');

    expect(inputCredsType).toHaveValue('CredsType');
  });

  it('project-id should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: {
            ...gsConfig,
            projectId: 'ProjectId',
          },
        }}
      />
    );
    const inputProjId = getByTestId(container, 'project-id');

    expect(inputProjId).toHaveValue('ProjectId');
  });

  it('private-key-id should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: {
            ...gsConfig,
            privateKeyId: 'PrivateKeyId',
          },
        }}
      />
    );
    const inputPrivateKeyId = getByTestId(container, 'private-key-id');

    expect(inputPrivateKeyId).toHaveValue('PrivateKeyId');
  });

  it('private-key should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: {
            ...gsConfig,
            privateKey: 'PrivateKey',
          },
        }}
      />
    );
    const inputPrivateKey = getByTestId(container, 'private-key');

    expect(inputPrivateKey).toHaveValue('PrivateKey');
  });

  it('client-email should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: { ...gsConfig, clientEmail: 'ClientEmail' },
        }}
      />
    );
    const inputClientEmail = getByTestId(container, 'client-email');

    expect(inputClientEmail).toHaveValue('ClientEmail');
  });

  it('client-id should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{ gcsConfig: { ...gsConfig, clientId: 'ClientId' } }}
      />
    );
    const inputClientId = getByTestId(container, 'client-id');

    expect(inputClientId).toHaveValue('ClientId');
  });

  it('auth-uri should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: { ...gsConfig, authUri: 'http://www.AuthUri.com' },
        }}
      />
    );
    const inputAuthUri = getByTestId(container, 'auth-uri');

    expect(inputAuthUri).toHaveValue('http://www.AuthUri.com');
  });

  it('token-uri should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: { ...gsConfig, tokenUri: 'http://www.TokenUri.com' },
        }}
      />
    );
    const inputTokenUri = getByTestId(container, 'token-uri');

    expect(inputTokenUri).toHaveValue('http://www.TokenUri.com');
  });

  it('auth-cert-uri should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: {
            ...gsConfig,
            authProviderX509CertUrl: 'http://www.AuthCertUri.com',
          },
        }}
      />
    );
    const inputAuthCertUri = getByTestId(
      container,
      'auth-x509-certificate-uri'
    );

    expect(inputAuthCertUri).toHaveValue('http://www.AuthCertUri.com');
  });

  it('client-cert-uri should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: {
            ...gsConfig,
            clientX509CertUrl: 'http://www.ClientCertUri.com',
          },
        }}
      />
    );
    const inputClientCertUri = getByTestId(
      container,
      'client-x509-certificate-uri'
    );

    expect(inputClientCertUri).toHaveValue('http://www.ClientCertUri.com');
  });

  it('gcs-creds-path should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{
          gcsConfig: 'GcsCredPath',
        }}
        gcsType={GCS_CONFIG.GCSCredentialsPath}
      />
    );
    const inputCredsPath = getByTestId(container, 'gcs-cred-path');

    expect(inputCredsPath).toHaveValue('GcsCredPath');
  });

  it('dbt-bucket-name should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtPrefixConfig={{
          dbtBucketName: 'Test Bucket',
        }}
      />
    );
    const inputBucketName = getByTestId(container, 'dbt-bucket-name');

    expect(inputBucketName).toHaveValue('Test Bucket');
  });

  it('dbt-object-prefix should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtPrefixConfig={{
          dbtObjectPrefix: 'Test Prefix',
        }}
      />
    );
    const inputObjPrefix = getByTestId(container, 'dbt-object-prefix');

    expect(inputObjPrefix).toHaveValue('Test Prefix');
  });

  it('security config should change', async () => {
    const { container } = render(<DBTGCSConfig {...mockProps} />);
    const inputCredsType = getByTestId(container, 'credential-type');
    const inputProjId = getByTestId(container, 'project-id');
    const inputPrivateKeyId = getByTestId(container, 'private-key-id');
    const inputPrivateKey = getByTestId(container, 'private-key');
    const inputClientEmail = getByTestId(container, 'client-email');
    const inputClientId = getByTestId(container, 'client-id');
    const inputAuthUri = getByTestId(container, 'auth-uri');
    const inputTokenUri = getByTestId(container, 'token-uri');
    const inputAuthCertUri = getByTestId(
      container,
      'auth-x509-certificate-uri'
    );
    const inputClientCertUri = getByTestId(
      container,
      'client-x509-certificate-uri'
    );

    fireEvent.change(inputCredsType, {
      target: {
        value: 'CredsType',
      },
    });

    fireEvent.change(inputProjId, {
      target: {
        value: 'ProjectId',
      },
    });

    fireEvent.change(inputPrivateKeyId, {
      target: {
        value: 'PrivateKeyId',
      },
    });

    fireEvent.change(inputPrivateKey, {
      target: {
        value: 'PrivateKey',
      },
    });

    fireEvent.change(inputClientEmail, {
      target: {
        value: 'ClientEmail',
      },
    });

    fireEvent.change(inputClientId, {
      target: {
        value: 'ClientId',
      },
    });

    fireEvent.change(inputAuthUri, {
      target: {
        value: 'http://www.AuthUri.com',
      },
    });

    fireEvent.change(inputTokenUri, {
      target: {
        value: 'http://www.TokenUri.com',
      },
    });

    fireEvent.change(inputAuthCertUri, {
      target: {
        value: 'http://www.AuthCertUri.com',
      },
    });

    fireEvent.change(inputClientCertUri, {
      target: {
        value: 'http://www.ClientCertUri.com',
      },
    });

    expect(mockSecurityConfigChange).toHaveBeenCalledTimes(10);
  });

  it('prefix config should change', async () => {
    const { container } = render(<DBTGCSConfig {...mockProps} />);
    const inputBucketName = getByTestId(container, 'dbt-bucket-name');
    const inputObjPrefix = getByTestId(container, 'dbt-object-prefix');

    fireEvent.change(inputBucketName, {
      target: {
        value: 'Test Bucket',
      },
    });

    fireEvent.change(inputObjPrefix, {
      target: {
        value: 'Test Prefix',
      },
    });

    expect(mockPrefixConfigChange).toHaveBeenCalledTimes(2);
  });

  it('should submit', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtPrefixConfig={{
          dbtBucketName: 'Test Bucket',
          dbtObjectPrefix: 'Test Prefix',
        }}
        dbtSecurityConfig={{
          gcsConfig: {
            type: 'CredsType',
            projectId: 'ProjectId',
            privateKeyId: 'PrivateKeyId',
            privateKey: 'PrivateKey',
            clientEmail: 'client@email.com',
            clientId: 'clientId',
            authUri: 'http://www.AuthUri.com',
            tokenUri: 'http://www.TokenUri.com',
            authProviderX509CertUrl: 'http://www.AuthCertUri.com',
            clientX509CertUrl: 'http://www.ClientCertUri.com',
          },
        }}
      />
    );
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).toHaveBeenCalled();
  });

  it('should cancel', async () => {
    const { container } = render(<DBTGCSConfig {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toHaveBeenCalled();
  });
});
