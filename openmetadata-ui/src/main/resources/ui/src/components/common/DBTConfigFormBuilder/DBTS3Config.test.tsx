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
import { DBTS3Config } from './DBTS3Config';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockPrefixConfigChange = jest.fn();
const mockSecurityConfigChange = jest.fn();

const mockProps = {
  okText: 'Next',
  cancelText: 'Back',
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handlePrefixConfigChange: mockPrefixConfigChange,
  handleSecurityConfigChange: mockSecurityConfigChange,
};

describe('Test DBT S3 Config Form', () => {
  it('Fields should render', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
    const inputAccessKeyId = getByTestId(container, 'aws-access-key-id');
    const inputSecretKey = getByTestId(container, 'aws-secret-access-key-id');
    const inputRegion = getByTestId(container, 'aws-region');
    const inputSessionToken = getByTestId(container, 'aws-session-token');
    const inputEndpointUrl = getByTestId(container, 'endpoint-url');

    expect(inputAccessKeyId).toBeInTheDocument();
    expect(inputSecretKey).toBeInTheDocument();
    expect(inputRegion).toBeInTheDocument();
    expect(inputSessionToken).toBeInTheDocument();
    expect(inputEndpointUrl).toBeInTheDocument();
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

    expect(mockSecurityConfigChange).toBeCalledTimes(5);
  });

  it('should show errors on submit', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).not.toBeCalled();
  });

  it('should submit', async () => {
    const { container } = render(
      <DBTS3Config
        {...mockProps}
        dbtSecurityConfig={{
          awsAccessKeyId: 'AccessKeyId',
          awsSecretAccessKey: 'SecretKey',
          awsRegion: 'Region',
        }}
      />
    );
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).toBeCalled();
  });

  it('should cancel', async () => {
    const { container } = render(<DBTS3Config {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toBeCalled();
  });
});
