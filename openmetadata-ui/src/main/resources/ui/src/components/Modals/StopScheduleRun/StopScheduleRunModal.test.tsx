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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { stopApp } from '../../../rest/applicationAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import StopScheduleModal from './StopScheduleRunModal';

jest.mock('../../../rest/applicationAPI', () => ({
  stopApp: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('StopScheduleModal', () => {
  const mockProps = {
    appName: 'test-app',
    displayName: 'Test App',
    isModalOpen: true,
    onClose: jest.fn(),
    onStopWorkflowsUpdate: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal', () => {
    render(<StopScheduleModal {...mockProps} />);

    expect(screen.getByTestId('stop-modal')).toBeInTheDocument();
  });

  it('should call stop app and display success toast on confirm', async () => {
    (stopApp as jest.Mock).mockResolvedValueOnce({ status: 200 });

    render(<StopScheduleModal {...mockProps} />);

    const confirmButton = screen.getByText('label.confirm');
    fireEvent.click(confirmButton);

    expect(stopApp).toHaveBeenCalledWith('test-app');

    await waitFor(() => {
      expect(mockProps.onStopWorkflowsUpdate).toHaveBeenCalled();
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('should call stop app and display error toast on failure', async () => {
    (stopApp as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(<StopScheduleModal {...mockProps} />);

    const confirmButton = screen.getByText('label.confirm');
    fireEvent.click(confirmButton);

    expect(stopApp).toHaveBeenCalledWith('test-app');

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(new Error('API Error'));
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel button is clicked', () => {
    render(<StopScheduleModal {...mockProps} />);

    const cancelButton = screen.getByText('label.cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });
});
