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
import React from 'react';
import { DBTS3Config } from './DBTS3Config';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockPrefixConfigChange = jest.fn();
const mockSecurityConfigChange = jest.fn();
const mockUpdateDescriptions = jest.fn();
const mockUpdateDBTClassification = jest.fn();

const mockProps = {
  okText: 'Next',
  cancelText: 'Back',
  dbtUpdateDescriptions: false,
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handlePrefixConfigChange: mockPrefixConfigChange,
  handleSecurityConfigChange: mockSecurityConfigChange,
  handleUpdateDescriptions: mockUpdateDescriptions,
  handleUpdateDBTClassification: mockUpdateDBTClassification,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT S3 Config Form', () => {
  it('Fields should render', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
    const inputAccessKeyId = getByTestId(container, 'aws-access-key-id');
    const inputSecretKey = getByTestId(container, 'aws-secret-access-key-id');
    const inputRegion = getByTestId(container, 'aws-region');
    const inputSessionToken = getByTestId(container, 'aws-session-token');
    const inputEndpointUrl = getByTestId(container, 'endpoint-url');
    const inputBucketName = getByTestId(container, 'dbt-bucket-name');
    const inputObjPrefix = getByTestId(container, 'dbt-object-prefix');

    expect(inputAccessKeyId).toBeInTheDocument();
    expect(inputSecretKey).toBeInTheDocument();
    expect(inputRegion).toBeInTheDocument();
    expect(inputSessionToken).toBeInTheDocument();
    expect(inputEndpointUrl).toBeInTheDocument();
    expect(inputBucketName).toBeInTheDocument();
    expect(inputObjPrefix).toBeInTheDocument();
  });

  it('access-key should render data', async () => {
    const { container } = render(
      <DBTS3Config
        {...mockProps}
        dbtSecurityConfig={{ awsAccessKeyId: 'AccessKeyId' }}
      />
    );
    const inputAccessKeyId = getByTestId(container, 'aws-access-key-id');

    expect(inputAccessKeyId).toHaveValue('AccessKeyId');
  });

  it('secret-key should render data', async () => {
    const { container } = render(
      <DBTS3Config
        {...mockProps}
        dbtSecurityConfig={{ awsSecretAccessKey: 'SecretKey' }}
      />
    );
    const inputSecretKey = getByTestId(container, 'aws-secret-access-key-id');

    expect(inputSecretKey).toHaveValue('SecretKey');
  });

  it('region should render data', async () => {
    const { container } = render(
      <DBTS3Config {...mockProps} dbtSecurityConfig={{ awsRegion: 'Region' }} />
    );
    const inputRegion = getByTestId(container, 'aws-region');

    expect(inputRegion).toHaveValue('Region');
  });

  it('session-token should render data', async () => {
    const { container } = render(
      <DBTS3Config
        {...mockProps}
        dbtSecurityConfig={{ awsSessionToken: 'SessionToken' }}
      />
    );
    const inputSessionToken = getByTestId(container, 'aws-session-token');

    expect(inputSessionToken).toHaveValue('SessionToken');
  });

  it('endpoint-url should render data', async () => {
    const { container } = render(
      <DBTS3Config
        {...mockProps}
        dbtSecurityConfig={{ endPointURL: 'EndpointUrl' }}
      />
    );
    const inputEndpointUrl = getByTestId(container, 'endpoint-url');

    expect(inputEndpointUrl).toHaveValue('EndpointUrl');
  });

  it('dbt-bucket-name should render data', async () => {
    const { container } = render(
      <DBTS3Config
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
      <DBTS3Config
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
    const { container } = render(<DBTS3Config {...mockProps} />);
    const inputAccessKeyId = getByTestId(container, 'aws-access-key-id');
    const inputSecretKey = getByTestId(container, 'aws-secret-access-key-id');
    const inputRegion = getByTestId(container, 'aws-region');
    const inputSessionToken = getByTestId(container, 'aws-session-token');
    const inputEndpointUrl = getByTestId(container, 'endpoint-url');

    fireEvent.change(inputAccessKeyId, {
      target: {
        value: 'AccessKeyId',
      },
    });

    fireEvent.change(inputSecretKey, {
      target: {
        value: 'SecretKey',
      },
    });

    fireEvent.change(inputRegion, {
      target: {
        value: 'Region',
      },
    });

    fireEvent.change(inputSessionToken, {
      target: {
        value: 'SessionToken',
      },
    });

    fireEvent.change(inputEndpointUrl, {
      target: {
        value: 'EndpointUrl',
      },
    });

    expect(mockSecurityConfigChange).toHaveBeenCalledTimes(5);
  });

  it('prefix config should change', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
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

  it('should show errors on submit', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('should submit', async () => {
    const { container } = render(
      <DBTS3Config
        {...mockProps}
        dbtPrefixConfig={{
          dbtBucketName: 'Test Bucket',
          dbtObjectPrefix: 'Test Prefix',
        }}
        dbtSecurityConfig={{
          awsAccessKeyId: 'AccessKeyId',
          awsSecretAccessKey: 'SecretKey',
          awsRegion: 'Region',
        }}
      />
    );
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).toHaveBeenCalled();
  });

  it('should cancel', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toHaveBeenCalled();
  });
});
