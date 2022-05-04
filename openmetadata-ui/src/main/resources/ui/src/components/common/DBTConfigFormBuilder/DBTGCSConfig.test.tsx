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
import { GCS_CONFIG } from './DBTFormEnum';
import { DBTGCSConfig } from './DBTGCSConfig';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockSecurityConfigChange = jest.fn();

const mockProps = {
  okText: 'Next',
  cancelText: 'Back',
  gcsType: GCS_CONFIG.GCSValues,
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handleSecurityConfigChange: mockSecurityConfigChange,
};

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
        dbtSecurityConfig={{ gcsConfig: { clientEmail: 'ClientEmail' } }}
      />
    );
    const inputClientEmail = getByTestId(container, 'client-email');

    expect(inputClientEmail).toHaveValue('ClientEmail');
  });

  it('client-id should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{ gcsConfig: { clientId: 'ClientId' } }}
      />
    );
    const inputClientId = getByTestId(container, 'client-id');

    expect(inputClientId).toHaveValue('ClientId');
  });

  it('auth-uri should render data', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
        dbtSecurityConfig={{ gcsConfig: { authUri: 'http://www.AuthUri.com' } }}
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
          gcsConfig: { tokenUri: 'http://www.TokenUri.com' },
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
          gcsConfig: { authProviderX509CertUrl: 'http://www.AuthCertUri.com' },
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
          gcsConfig: { clientX509CertUrl: 'http://www.ClientCertUri.com' },
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

    expect(mockSecurityConfigChange).toBeCalledTimes(10);
  });

  it('should show errors on submit', async () => {
    const { container } = render(<DBTGCSConfig {...mockProps} />);
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).not.toBeCalled();
  });

  it('should submit', async () => {
    const { container } = render(
      <DBTGCSConfig
        {...mockProps}
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

    expect(mockSubmit).toBeCalled();
  });

  it('should cancel', async () => {
    const { container } = render(<DBTGCSConfig {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toBeCalled();
  });
});
