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
import { DBTCloudConfig } from './DBTCloudConfig';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockAccountIdChange = jest.fn();
const mockAuthTokenChange = jest.fn();
const mockUpdateDescriptions = jest.fn();
const mockDbtCloudProjectId = jest.fn();
const mockDbtCloudJobId = jest.fn();
const mockUpdateDBTClassification = jest.fn();
const mockUpdateDBTCloudUrl = jest.fn();
const mockHandleEnableDebugLogCheck = jest.fn();

const mockProps = {
  dbtCloudAccountId: '',
  dbtCloudAuthToken: '',
  dbtUpdateDescriptions: false,
  dbtCloudUrl: 'https://cloud.getdbt.com/',
  okText: 'Next',
  cancelText: 'Back',
  onCancel: mockCancel,
  onSubmit: mockSubmit,
  handleCloudAccountIdChange: mockAccountIdChange,
  handleCloudAuthTokenChange: mockAuthTokenChange,
  handleUpdateDescriptions: mockUpdateDescriptions,
  handleDbtCloudProjectId: mockDbtCloudProjectId,
  handleDbtCloudJobId: mockDbtCloudJobId,
  handleDbtCloudUrl: mockUpdateDBTCloudUrl,
  handleUpdateDBTClassification: mockUpdateDBTClassification,
  enableDebugLog: false,
  handleEnableDebugLogCheck: mockHandleEnableDebugLogCheck,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT Cloud Config Form', () => {
  it('Fields should render', async () => {
    const { container } = render(<DBTCloudConfig {...mockProps} />);
    const inputAccountId = getByTestId(container, 'cloud-account-id');
    const InputAuthToken = getByTestId(container, 'cloud-auth-token');

    expect(inputAccountId).toBeInTheDocument();
    expect(InputAuthToken).toBeInTheDocument();
  });

  it('Account Id should be displayed when passed as prop', async () => {
    const { container } = render(
      <DBTCloudConfig {...mockProps} dbtCloudAccountId="Test_Id" />
    );
    const inputAccountId = getByTestId(container, 'cloud-account-id');

    expect(inputAccountId).toHaveValue('Test_Id');
  });

  it('Job Id should be displayed when passed as prop', async () => {
    const { container } = render(
      <DBTCloudConfig {...mockProps} dbtCloudJobId="Job_Id" />
    );
    const dbtCloudJobId = getByTestId(container, 'dbtCloudJobId');

    expect(dbtCloudJobId).toHaveValue('Job_Id');
  });

  it('Authorization Token should be displayed when passed as prop', async () => {
    const { container } = render(
      <DBTCloudConfig {...mockProps} dbtCloudAuthToken="Test_Token" />
    );
    const InputAuthToken = getByTestId(container, 'cloud-auth-token');

    expect(InputAuthToken).toHaveValue('Test_Token');
  });

  it('Auth Id should change with input', async () => {
    const { container } = render(<DBTCloudConfig {...mockProps} />);
    const inputAccountId = getByTestId(container, 'cloud-account-id');

    fireEvent.change(inputAccountId, {
      target: {
        value: 'Test_Id',
      },
    });

    expect(mockAccountIdChange).toHaveBeenCalled();
  });

  it('Job Id should change with input', async () => {
    const { container } = render(<DBTCloudConfig {...mockProps} />);
    const dbtCloudJobId = getByTestId(container, 'dbtCloudJobId');

    fireEvent.change(dbtCloudJobId, {
      target: {
        value: 'Job_Id',
      },
    });

    expect(mockDbtCloudJobId).toHaveBeenCalledWith('Job_Id');
  });

  it('Authorization Token should change with input', async () => {
    const { container } = render(<DBTCloudConfig {...mockProps} />);
    const InputAuthToken = getByTestId(container, 'cloud-auth-token');

    fireEvent.change(InputAuthToken, {
      target: {
        value: 'Test_Token',
      },
    });

    expect(mockAuthTokenChange).toHaveBeenCalled();
  });

  it('Should show errors on submit when required fields do not have value provided', async () => {
    const { container } = render(<DBTCloudConfig {...mockProps} />);
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('Should submit successfully when required fields have value provided', async () => {
    const { container } = render(
      <DBTCloudConfig
        {...mockProps}
        dbtCloudAccountId="Test_Id"
        dbtCloudAuthToken="Test_Token"
      />
    );
    const submitBtn = getByTestId(container, 'submit-btn');

    fireEvent.click(submitBtn);

    expect(mockSubmit).toHaveBeenCalled();
  });

  it('Should successfully cancel the operation', async () => {
    const { container } = render(<DBTCloudConfig {...mockProps} />);
    const backBtn = getByTestId(container, 'back-button');

    fireEvent.click(backBtn);

    expect(mockCancel).toHaveBeenCalled();
  });
});
