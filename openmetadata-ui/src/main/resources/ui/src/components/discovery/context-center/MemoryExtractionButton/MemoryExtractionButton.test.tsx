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
import { focusManager } from '@tanstack/react-query';
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
    [Reason.ProviderDisabled, 'message.memory-extraction-ai-platform-off'],
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

  // The server's English text is for API callers: each refusal is told in the user's language.
  it('after a 409 reads the document and the availability again, and says the run cannot start while it is still available', async () => {
    const reread = { id: 'doc-1', processingStatus: 'Processed' };
    request.mockRejectedValue(
      httpError(409, "This document's memories are already queued.")
    );
    reload.mockResolvedValue(reread);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.memory-extraction-cannot-start'
      )
    );

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(getExtractionAvailability).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith(reread);
    expect(button()).toBeEnabled();
  });

  it.each([
    [Reason.ExtractionDisabled, 'message.memory-extraction-off'],
    [Reason.ProviderDisabled, 'message.memory-extraction-ai-platform-off'],
    [
      Reason.ProviderUnavailable,
      'message.memory-extraction-service-unavailable',
    ],
  ])(
    'after a 409 says why extraction became unavailable (%s), and disables the action with that reason',
    async (reason, message) => {
      (getExtractionAvailability as jest.Mock)
        .mockResolvedValueOnce({ available: true })
        .mockResolvedValue({ available: false, reason });
      request.mockRejectedValue(
        httpError(409, `Memory extraction is unavailable: ${reason}`)
      );
      reload.mockResolvedValue({ id: 'doc-1', processingStatus: 'Processed' });
      await renderButton();

      fireEvent.click(button());

      await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(message));

      expect(screen.getByRole('group', { name: message })).toContainElement(
        button()
      );
      expect(button()).toBeDisabled();
    }
  );

  it('after a 409 still says the run cannot start when the availability cannot be read', async () => {
    (getExtractionAvailability as jest.Mock)
      .mockResolvedValueOnce({ available: true })
      .mockRejectedValue(new AxiosError('Network Error'));
    request.mockRejectedValue(httpError(409, 'Already queued.'));
    reload.mockResolvedValue({ id: 'doc-1', processingStatus: 'Processed' });
    await renderButton();

    fireEvent.click(button());

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.memory-extraction-cannot-start'
      )
    );

    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  // A refused queue leaves the document Failed, which the re-read shows with Retry.
  it('after a 503 says the run could not be queued and reads the document again', async () => {
    const failed = { id: 'doc-1', processingStatus: 'Failed' };
    request.mockRejectedValue(
      httpError(503, 'Memory extraction could not be queued.')
    );
    reload.mockResolvedValue(failed);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(failed));

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.memory-extraction-not-queued'
    );
    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(getExtractionAvailability).toHaveBeenCalledTimes(1);
    expect(button()).toBeEnabled();
    expect(button()).not.toHaveAttribute('data-loading');
  });

  it('reports a re-read that fails too', async () => {
    const lost = new AxiosError('Network Error');
    request.mockRejectedValue(httpError(503, 'Text extraction queue is full.'));
    reload.mockRejectedValue(lost);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(lost));

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.memory-extraction-not-queued'
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('reports any other failure as it is and reads the document again', async () => {
    const lost = new AxiosError('Network Error');
    const reread = { id: 'doc-1', processingStatus: 'Processed' };
    request.mockRejectedValue(lost);
    reload.mockResolvedValue(reread);
    await renderButton();

    fireEvent.click(button());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(reread));

    expect(showErrorToast).toHaveBeenCalledWith(lost);
  });

  it('says only owners and admins may extract, and hides the action, after a 403', async () => {
    request.mockRejectedValue(
      httpError(
        403,
        "Only the document's owners or an admin can extract its memories."
      )
    );
    await renderButton();

    fireEvent.click(button());

    await waitFor(() =>
      expect(
        screen.queryByTestId('memory-extraction-btn')
      ).not.toBeInTheDocument()
    );

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.memory-extraction-owners-or-admins-only'
    );
    expect(showErrorToast).toHaveBeenCalledTimes(1);
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

// The availability can change at runtime (Collate's AI platform comes back), so it goes stale.
describe('MemoryExtractionButton availability', () => {
  const regainFocus = () =>
    act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

  beforeEach(() => {
    signIn({});
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: true,
    });
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
    act(() => {
      useApplicationStore.setState({ currentUser: undefined });
    });
  });

  const renderTwoDocuments = () =>
    act(async () => {
      renderWithQueryClient(
        <>
          {['doc-1', 'doc-2'].map((documentId) => (
            <MemoryExtractionButton<Document>
              action={MemoryExtractionAction.Extract}
              documentId={documentId}
              key={documentId}
              owners={OWNERS}
              reload={reload}
              request={request}
              onUpdate={onUpdate}
            />
          ))}
        </>
      );
    });

  it('is read once for every action on the page', async () => {
    await renderTwoDocuments();

    expect(screen.getAllByTestId('memory-extraction-btn')).toHaveLength(2);
    expect(getExtractionAvailability).toHaveBeenCalledTimes(1);
  });

  it('is read again, once for the page, when the window regains focus after a minute', async () => {
    await renderTwoDocuments();

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    await regainFocus();

    expect(getExtractionAvailability).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(31_000);
    });
    await regainFocus();

    expect(getExtractionAvailability).toHaveBeenCalledTimes(2);
  });
});
