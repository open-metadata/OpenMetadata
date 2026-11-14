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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  getMcpClients,
  revokeMcpClient,
  revokeMcpClientTokens,
} from '../../../../../rest/mcpConfigAPI';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import McpClientsTable from './McpClientsTable';

jest.mock('../../../../../rest/mcpConfigAPI', () => ({
  getMcpClients: jest.fn(),
  revokeMcpClient: jest.fn(),
  revokeMcpClientTokens: jest.fn(),
}));
jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const client = {
  clientId: 'client-1',
  clientName: 'Test assistant',
  redirectUris: ['https://client.example/callback'],
  issuedAt: 1700000000000,
  activeAccessTokens: 3,
  activeRefreshTokens: 2,
};
const list = jest.mocked(getMcpClients);
const revoke = jest.mocked(revokeMcpClient);
const renderTable = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }>
      <McpClientsTable />
    </QueryClientProvider>
  );

describe('McpClientsTable', () => {
  it('shows active token counts and revokes tokens without removing the client', async () => {
    jest.mocked(revokeMcpClientTokens).mockResolvedValue(undefined);
    renderTable();

    expect(await screen.findByText('3')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'label.mcp-revoke-tokens' })
    );
    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByText('message.mcp-revoke-tokens-confirm')
    ).toBeVisible();

    list.mockResolvedValue([
      { ...client, activeAccessTokens: 0, activeRefreshTokens: 0 },
    ]);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'label.revoke' })
    );
    await waitFor(() => expect(revokeMcpClientTokens).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );

    expect(screen.getByText(client.clientName)).toBeVisible();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(revoke).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    list.mockResolvedValue([client]);
    revoke.mockResolvedValue(undefined);
  });

  it('shows the registered identity and callback without making it a clickable link', async () => {
    renderTable();

    expect(await screen.findByText(client.clientName)).toBeVisible();
    expect(screen.getByText(client.clientId)).toBeVisible();
    expect(screen.getByText(client.redirectUris[0])).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('requires confirmation and allows cancellation without revoking', async () => {
    renderTable();
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.mcp-remove-client' })
    );
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(client.clientId)).toBeVisible();
    expect(revoke).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'label.cancel' })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );

    expect(revoke).not.toHaveBeenCalled();
  });

  it('revokes the selected ID and reloads the inventory', async () => {
    renderTable();
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.mcp-remove-client' })
    );
    list.mockResolvedValue([]);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'label.revoke',
      })
    );
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(client.clientId));

    expect(await screen.findByText('message.mcp-no-clients')).toBeVisible();
    expect(screen.queryByText(client.clientName)).not.toBeInTheDocument();
  });

  it('keeps the client and confirmation available when revocation fails', async () => {
    const failure = { response: { status: 500 } };
    revoke.mockRejectedValue(failure);
    renderTable();
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.mcp-remove-client' })
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'label.revoke',
      })
    );
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(failure));

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(client.clientName)).toBeVisible();
  });

  it('shows a retryable error rather than claiming the inventory is empty', async () => {
    list.mockRejectedValueOnce(new Error('unavailable'));
    renderTable();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'message.mcp-clients-load-error'
    );
    expect(
      screen.queryByText('message.mcp-no-clients')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(await screen.findByText(client.clientName)).toBeVisible();
  });

  it('uses the last client ID as the next-page cursor and supports going back', async () => {
    const page = Array.from({ length: 25 }, (_, index) => ({
      ...client,
      clientId: `id-${index}`,
      clientName: `Assistant ${index}`,
    }));
    list.mockImplementation(async (after) => (after ? [client] : page));
    renderTable();
    await screen.findByText('Assistant 24');
    fireEvent.click(screen.getByRole('button', { name: 'label.next' }));

    expect(await screen.findByText(client.clientName)).toBeVisible();
    expect(list).toHaveBeenCalledWith('id-24');

    fireEvent.click(screen.getByRole('button', { name: 'label.previous' }));

    expect(await screen.findByText('Assistant 0')).toBeVisible();
  });
});
