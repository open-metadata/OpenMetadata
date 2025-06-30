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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionType } from '../../../generated/entity/feed/suggestion';
import { mockEntityPermissions } from '../../../pages/DatabaseSchemaPage/mocks/DatabaseSchemaPage.mock';
import {
  approveRejectAllSuggestions,
  getSuggestionsByUserId,
  getSuggestionsList,
  updateSuggestionStatus,
} from '../../../rest/suggestionsAPI';
import SuggestionsProvider, {
  useSuggestionsContext,
} from './SuggestionsProvider';
import { SuggestionAction } from './SuggestionsProvider.interface';

const suggestions = [
  {
    id: '1',
    description: 'Test suggestion1',
    createdBy: { id: '1', name: 'Avatar 1', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
  {
    id: '2',
    description: 'Test suggestion2',
    createdBy: { id: '2', name: 'Avatar 2', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
];

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest.fn().mockImplementation(() => Promise.resolve()),
  getSuggestionsByUserId: jest.fn().mockImplementation(() => Promise.resolve()),
  fetchSuggestionsByUserId: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  approveRejectAllSuggestions: jest.fn(),
  updateSuggestionStatus: jest.fn(),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: mockEntityPermissions,
  })),
}));

function TestComponent() {
  const {
    acceptRejectAllSuggestions,
    onUpdateActiveUser,
    acceptRejectSuggestion,
    fetchSuggestionsByUserId,
  } = useSuggestionsContext();

  return (
    <>
      <button
        onClick={() => acceptRejectAllSuggestions(SuggestionAction.Accept)}>
        Accept All
      </button>
      <button
        onClick={() => acceptRejectAllSuggestions(SuggestionAction.Reject)}>
        Reject All
      </button>
      <button
        onClick={() =>
          onUpdateActiveUser({ id: '1', name: 'Avatar 1', type: 'user' })
        }>
        Active User
      </button>
      <button
        onClick={() =>
          acceptRejectSuggestion(suggestions[0], SuggestionAction.Accept)
        }>
        Accept One
      </button>
      <button
        onClick={() =>
          acceptRejectSuggestion(suggestions[0], SuggestionAction.Reject)
        }>
        Reject One
      </button>
      <button onClick={() => fetchSuggestionsByUserId('test-user-id')}>
        Fetch By User ID
      </button>
    </>
  );
}

describe('SuggestionsProvider', () => {
  it('renders provider and fetches data', async () => {
    await act(async () => {
      render(
        <SuggestionsProvider>
          <TestComponent />
        </SuggestionsProvider>
      );
    });

    expect(getSuggestionsList).toHaveBeenCalledWith({
      entityFQN: 'mockFQN',
      limit: 10,
    });
  });

  it('calls approveRejectAllSuggestions when button is clicked', () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const button = screen.getByText('Active User');
    fireEvent.click(button);

    const acceptAllBtn = screen.getByText('Accept All');
    fireEvent.click(acceptAllBtn);

    expect(approveRejectAllSuggestions).toHaveBeenCalledWith(
      '1',
      'mockFQN',
      SuggestionType.SuggestDescription,
      SuggestionAction.Accept
    );
  });

  it('calls approveRejectAllSuggestions when reject button is clicked', () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const button = screen.getByText('Active User');
    fireEvent.click(button);

    const rejectAll = screen.getByText('Reject All');
    fireEvent.click(rejectAll);

    expect(approveRejectAllSuggestions).toHaveBeenCalledWith(
      '1',
      'mockFQN',
      SuggestionType.SuggestDescription,
      SuggestionAction.Reject
    );
  });

  it('calls accept suggestion when accept button is clicked', () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const acceptBtn = screen.getByText('Accept One');
    fireEvent.click(acceptBtn);

    expect(updateSuggestionStatus).toHaveBeenCalledWith(
      suggestions[0],
      SuggestionAction.Accept
    );
  });

  it('calls reject suggestion when accept button is clicked', () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const rejectBtn = screen.getByText('Reject One');
    fireEvent.click(rejectBtn);

    expect(updateSuggestionStatus).toHaveBeenCalledWith(
      suggestions[0],
      SuggestionAction.Reject
    );
  });

  it('calls fetchSuggestionsByUserId when button is clicked', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const fetchByUserIdBtn = screen.getByText('Fetch By User ID');
    fireEvent.click(fetchByUserIdBtn);

    expect(getSuggestionsByUserId).toHaveBeenCalledWith('test-user-id', {
      entityFQN: 'mockFQN',
      limit: 10,
    });
  });
});
