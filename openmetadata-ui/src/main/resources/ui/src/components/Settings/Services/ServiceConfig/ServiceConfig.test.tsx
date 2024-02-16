/*
 *  Copyright 2024 Collate.
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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ServiceCategory } from '../../../../enums/service.enum';
import ServiceConfig from './ServiceConfig';

const mockHandleUpdate = jest.fn();
const mockOnFocus = jest.fn();

const formData = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'admin',
  authType: {
    password: '*********',
  },
  hostPort: 'host.docker.internal:3306',
  sslKey: 'test',
  supportsMetadataExtraction: true,
  supportsDBTExtraction: true,
  supportsProfiler: true,
  supportsQueryComment: true,
};

const mockProps = {
  disableTestConnection: false,
  handleUpdate: mockHandleUpdate,
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceFQN: 'testFQN',
  serviceType: 'testType',
  onFocus: mockOnFocus,
};

const mockUseHistory = {
  push: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('../../../../utils/RouterUtils', () => ({
  getPathByServiceFQN: jest.fn().mockReturnValue('/test-path'),
}));

jest.mock('./ConnectionConfigForm', () => {
  return jest.fn().mockImplementation(({ onCancel, onSave }) => (
    <div>
      ManageButton.component
      <button data-testid="cancel-btn" onClick={onCancel}>
        Cancel Button
      </button>
      <button data-testid="save-btn" onClick={() => onSave({ formData })}>
        Save Button
      </button>
    </div>
  ));
});

jest.mock('react-router-dom', () => {
  return {
    useHistory: jest.fn().mockImplementation(() => mockUseHistory),
  };
});

describe('ServiceConfig', () => {
  it('should render Service Config', () => {
    render(<ServiceConfig {...mockProps} />);

    expect(screen.getByTestId('service-config')).toBeInTheDocument();
  });

  it('should render service config form', async () => {
    await render(<ServiceConfig {...mockProps} />);

    expect(await screen.findByTestId('service-config')).toBeInTheDocument();
    expect(await screen.findByTestId('cancel-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('save-btn')).toBeInTheDocument();
  });

  it('should call handleUpdate and redirect', async () => {
    jest.useFakeTimers();

    render(<ServiceConfig {...mockProps} />);
    const saveButton = await screen.findByTestId('save-btn');
    await act(async () => {
      userEvent.click(saveButton);
    });

    expect(mockHandleUpdate).toHaveBeenCalled();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(mockUseHistory.push).toHaveBeenCalledWith('/test-path');
  });

  it('should call goBack when cancel button is clicked', async () => {
    render(<ServiceConfig {...mockProps} />);
    const cancelButton = await screen.findByTestId('cancel-btn');
    await act(async () => {
      userEvent.click(cancelButton);
    });

    expect(mockUseHistory.goBack).toHaveBeenCalled();
  });
});
