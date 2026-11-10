/*
 *  Copyright 2026 Collate.
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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { ODCS_EXPORT_VERSIONS } from '../../../constants/DataContract.constants';
import APIClient from '../../../rest/axiosClient';
import { downloadContractAsODCSYaml } from '../../../utils/DataContract/DataContractUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ODCSExportModal } from './ODCSExportModal';

jest.mock('../../../rest/axiosClient', () => ({ get: jest.fn() }));
jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  downloadContractAsODCSYaml: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const onClose = jest.fn();

const renderModal = () =>
  render(
    <ODCSExportModal
      contractId="contract-id"
      contractName="Customers"
      onClose={onClose}
    />
  );

describe('ODCSExportModal', () => {
  beforeEach(() => {
    (APIClient.get as jest.Mock)
      .mockReset()
      .mockResolvedValue({ data: 'apiVersion: v3.1.0' });
  });

  it('defaults to v3.1.0 and lists only supported export versions', async () => {
    renderModal();
    const selector = screen.getByRole('button', { name: /label.version/ });

    expect(selector).toHaveTextContent('v3.1.0');
    expect(APIClient.get).not.toHaveBeenCalled();

    await user.click(selector);

    expect(
      screen.getAllByRole('option').map((item) => item.textContent)
    ).toEqual(['v3.1.0', 'v3.0.2', 'v3.0.1', 'v3.0.0', 'v2.2.2', 'v2.2.1']);
  });

  it.each(ODCS_EXPORT_VERSIONS)(
    'downloads the selected %s export',
    async (version) => {
      const yaml = `apiVersion: ${version}`;
      (APIClient.get as jest.Mock).mockResolvedValue({ data: yaml });
      renderModal();

      await user.click(screen.getByRole('button', { name: /label.version/ }));
      await user.click(screen.getByRole('option', { name: version }));
      await user.click(screen.getByRole('button', { name: 'label.export' }));

      await waitFor(() =>
        expect(downloadContractAsODCSYaml).toHaveBeenCalledWith(
          yaml,
          'Customers'
        )
      );

      expect(APIClient.get).toHaveBeenCalledWith(
        '/dataContracts/contract-id/odcs/yaml',
        expect.objectContaining({
          params: { fields: undefined, odcsVersion: version },
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  );

  it('cancels without fetching or downloading a contract', async () => {
    renderModal();
    await user.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(APIClient.get).not.toHaveBeenCalled();
    expect(downloadContractAsODCSYaml).not.toHaveBeenCalled();
  });

  it('keeps the selected version available for retry after an error', async () => {
    const error = new AxiosError('Export failed');
    (APIClient.get as jest.Mock)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ data: 'apiVersion: v2.2.2' });
    renderModal();
    await user.click(screen.getByRole('button', { name: /label.version/ }));
    await user.click(screen.getByRole('option', { name: 'v2.2.2' }));
    await user.click(screen.getByRole('button', { name: 'label.export' }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(onClose).not.toHaveBeenCalled();
    expect(downloadContractAsODCSYaml).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /label.version/ })
    ).toHaveTextContent('v2.2.2');

    const retryButton = screen.getByRole('button', { name: 'label.export' });
    await waitFor(() => expect(retryButton).toBeEnabled());
    retryButton.focus();
    await user.keyboard('{Enter}');

    expect(APIClient.get).toHaveBeenCalledTimes(2);

    await waitFor(() =>
      expect(downloadContractAsODCSYaml).toHaveBeenCalledWith(
        'apiVersion: v2.2.2',
        'Customers'
      )
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables selection and duplicate exports while the request is pending', async () => {
    let resolve: ((value: { data: string }) => void) | undefined;
    (APIClient.get as jest.Mock).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderModal();
    await user.click(screen.getByRole('button', { name: 'label.export' }));

    expect(
      screen.getByRole('button', { name: /label.version/ })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeDisabled();
    expect(screen.getByTestId('confirm-odcs-export')).toBeDisabled();

    await act(async () => {
      screen.getByTestId('confirm-odcs-export').click();
    });
    await user.keyboard('{Escape}');

    expect(APIClient.get).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolve?.({ data: 'apiVersion: v3.1.0' });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
