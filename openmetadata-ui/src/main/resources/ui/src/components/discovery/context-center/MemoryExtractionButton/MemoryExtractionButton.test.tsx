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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { MemoryExtractionAction } from '../../../../constants/ContextCenter.constants';
import { Reason } from '../../../../generated/api/context/extractionAvailability';
import { User } from '../../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getExtractionAvailability } from '../../../../rest/contextMemoryAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import MemoryExtractionButton from './MemoryExtractionButton';

jest.mock('../../../../rest/contextMemoryAPI', () => ({
  getExtractionAvailability: jest.fn(),
}));

interface Document {
  id: string;
  processingStatus: string;
}

runQueryNotificationsSynchronously();

const OWNERS = [{ id: 'user-alice', type: 'user', name: 'alice' }];

const signIn = (overrides: Partial<User>) =>
  useApplicationStore.setState({
    currentUser: {
      id: 'user-alice',
      name: 'alice',
      email: 'alice@example.com',
      ...overrides,
    },
  });

const httpError = (status: number, message: string) =>
  new AxiosError(message, undefined, undefined, undefined, {
    status,
    data: { code: status, message },
  } as AxiosResponse);

const request = jest.fn();
const reload = jest.fn();
const onUpdate = jest.fn();

// The availability read settles inside the act, so no assertion runs on a half-rendered button.
const renderButton = async (
  props: Partial<{
    action: MemoryExtractionAction;
    documentId: string;
    owners: typeof OWNERS;
  }> = {}
) => {
  let result: ReturnType<typeof renderWithQueryClient> | undefined;
  await act(async () => {
    result = renderWithQueryClient(
      <MemoryExtractionButton<Document>
        action={MemoryExtractionAction.Extract}
        documentId="doc-1"
        owners={OWNERS}
        reload={reload}
        request={request}
        onUpdate={onUpdate}
        {...props}
      />
    );
  });

  return result as ReturnType<typeof renderWithQueryClient>;
};

const button = () => screen.getByTestId('memory-extraction-btn');

describe('MemoryExtractionButton', () => {
  beforeEach(() => {
    signIn({});
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: true,
    });
  });

  // RTL unmounts after this hook, so the sign-out still re-renders the tree.
  afterEach(() => {
    act(() => {
      useApplicationStore.setState({ currentUser: undefined });
    });
  });

  it('offers Extract to an owner of the document', async () => {
    await renderButton();

    expect(button()).toHaveTextContent('label.extract');

    await waitFor(() => expect(getExtractionAvailability).toHaveBeenCalled());

    expect(button()).toBeEnabled();
  });

  it('offers Retry to an admin who does not own the document', async () => {
    signIn({ id: 'user-root', name: 'root', isAdmin: true });
    await renderButton({ action: MemoryExtractionAction.Retry });

    expect(button()).toHaveTextContent('label.retry');
  });

  it('offers it to a member of an owning team', async () => {
    signIn({
      id: 'user-bob',
      name: 'bob',
      teams: [{ id: 'team-finance', type: 'team' }],
    });
    await renderButton({
      owners: [{ id: 'team-finance', type: 'team', name: 'finance' }],
    });

    expect(button()).toHaveTextContent('label.extract');
  });

  it('is not offered to anyone else, who never reads the availability', async () => {
    signIn({ id: 'user-bob', name: 'bob' });
    await renderButton();

    expect(
      screen.queryByTestId('memory-extraction-btn')
    ).not.toBeInTheDocument();
    expect(getExtractionAvailability).not.toHaveBeenCalled();
  });

  it('is not offered when the document has nothing to extract or retry', async () => {
    await renderButton({ action: undefined });

    expect(
      screen.queryByTestId('memory-extraction-btn')
    ).not.toBeInTheDocument();
  });

  it.each([
    [Reason.ExtractionDisabled, 'message.memory-extraction-off'],
    [
      Reason.ProviderUnavailable,
      'message.memory-extraction-service-unavailable',
    ],
  ])(
    'is disabled with the reason while extraction is unavailable (%s)',
    async (reason, message) => {
      (getExtractionAvailability as jest.Mock).mockResolvedValue({
        available: false,
        reason,
      });
      await renderButton();

      expect(
        await screen.findByRole('group', { name: message })
      ).toContainElement(button());
      expect(button()).toBeDisabled();
    }
  );

  it('requests the extraction and hands back the document it returns', async () => {
    const queued = { id: 'doc-1', processingStatus: 'ExtractingContext' };
    request.mockResolvedValue(queued);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(queued));

    expect(request).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('shows the server message after a 409, then reads the document and the availability again', async () => {
    const refusal = httpError(
      409,
      'Memory extraction is unavailable: ExtractionDisabled'
    );
    const reread = { id: 'doc-1', processingStatus: 'Processed' };
    request.mockRejectedValue(refusal);
    reload.mockResolvedValue(reread);
    await renderButton();
    await waitFor(() =>
      expect(getExtractionAvailability).toHaveBeenCalledTimes(1)
    );

    fireEvent.click(button());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(reread));

    expect(showErrorToast).toHaveBeenCalledWith(refusal);

    await waitFor(() =>
      expect(getExtractionAvailability).toHaveBeenCalledTimes(2)
    );
  });

  // A refused queue leaves the document Failed, which the re-read shows with Retry.
  it('shows the server message after a 503 and reads the document again', async () => {
    const refusal = httpError(
      503,
      'Unable to queue knowledge pill extraction. Please retry later.'
    );
    const failed = { id: 'doc-1', processingStatus: 'Failed' };
    request.mockRejectedValue(refusal);
    reload.mockResolvedValue(failed);
    await renderButton();
    await waitFor(() => expect(getExtractionAvailability).toHaveBeenCalled());

    fireEvent.click(button());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(failed));

    expect(showErrorToast).toHaveBeenCalledWith(refusal);
    expect(getExtractionAvailability).toHaveBeenCalledTimes(1);
    expect(button()).toBeEnabled();
    expect(button()).not.toHaveAttribute('data-loading');
  });

  it('reports a re-read that fails too', async () => {
    const refusal = httpError(503, 'Text extraction queue is full.');
    const lost = new AxiosError('Network Error');
    request.mockRejectedValue(refusal);
    reload.mockRejectedValue(lost);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(lost));

    expect(showErrorToast).toHaveBeenCalledWith(refusal);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('hides the action after a 403', async () => {
    const refusal = httpError(
      403,
      "Only the document's owners or an admin can extract its memories."
    );
    request.mockRejectedValue(refusal);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() =>
      expect(
        screen.queryByTestId('memory-extraction-btn')
      ).not.toBeInTheDocument()
    );

    expect(showErrorToast).toHaveBeenCalledWith(refusal);
    expect(reload).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('spins while the request runs and stops once it settles', async () => {
    let settle: (document: Document) => void = jest.fn();
    request.mockReturnValue(
      new Promise<Document>((resolve) => {
        settle = resolve;
      })
    );
    await renderButton();

    fireEvent.click(button());

    await waitFor(() =>
      expect(button()).toHaveAttribute('data-loading', 'true')
    );

    await act(async () => {
      settle({ id: 'doc-1', processingStatus: 'ExtractingContext' });
    });

    expect(button()).not.toHaveAttribute('data-loading');
  });

  it('shows no request still running for another document on this one', async () => {
    request.mockReturnValue(new Promise(jest.fn()));
    const { rerender } = await renderButton();

    fireEvent.click(button());
    await waitFor(() =>
      expect(button()).toHaveAttribute('data-loading', 'true')
    );

    rerender(
      <MemoryExtractionButton<Document>
        action={MemoryExtractionAction.Extract}
        documentId="doc-2"
        owners={OWNERS}
        reload={reload}
        request={request}
        onUpdate={onUpdate}
      />
    );

    expect(button()).not.toHaveAttribute('data-loading');
  });
});
