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

const mockProps = {
  gcsType: GCS_CONFIG.GCSValues,
  dbtUpdateDescriptions: false,
  enableDebugLog: false,
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

    expect(inputAuthCertUri).toHaveValue('http://www.AuthCertUri.com');
    expect(inputPrivateKey).toHaveValue('PrivateKey');
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

    expect(inputBucketName).toHaveValue('Test Bucket');
    expect(inputObjPrefix).toHaveValue('Test Prefix');
  });
});
