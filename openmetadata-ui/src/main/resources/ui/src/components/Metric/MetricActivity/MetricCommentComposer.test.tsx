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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { searchQuery } from '../../../rest/searchAPI';
import MetricCommentComposer from './MetricCommentComposer';

jest.mock('../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('MetricCommentComposer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches and inserts a mention with keyboard navigation', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'user-1',
            _source: {
              displayName: 'Alice',
              entityType: 'user',
              fullyQualifiedName: 'alice',
            },
          },
        ],
      },
    });
    render(<MetricCommentComposer onSubmit={jest.fn()} />, { wrapper });
    const composer = screen.getByRole('textbox', { name: 'label.comment' });
    fireEvent.change(composer, { target: { value: 'Ask @ali' } });

    const suggestions = await screen.findByRole('list', {
      name: 'label.suggestion-lowercase-plural',
    });

    expect(suggestions).toBeVisible();

    const suggestion = await screen.findByRole('button', {
      name: /Alice · label.user/,
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(suggestion).toHaveTextContent('Alice · label.user');
    expect(suggestion).not.toHaveTextContent('Alice · user');
    expect(suggestion).toHaveAttribute('aria-current', 'true');

    act(() => suggestion.focus());

    expect(suggestion).toHaveFocus();

    fireEvent.keyDown(suggestion, { key: 'Enter' });
    fireEvent.keyUp(suggestion, { key: 'Enter' });

    expect(composer).toHaveValue('Ask <#E::user::alice|@Alice> ');
  });

  it('renders a localized error when suggestion search fails', async () => {
    (searchQuery as jest.Mock).mockRejectedValue(new Error('network'));
    render(<MetricCommentComposer onSubmit={jest.fn()} />, { wrapper });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Check #orders' },
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'server.entity-fetch-error'
      )
    );
  });
});
