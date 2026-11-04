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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Persona } from '../../../generated/entity/teams/persona';
import { CacheState } from '../../../generated/type/personaContextStatus';
import {
  getAllPersonas,
  getPersonaAIContextStatus,
  updatePersonaAIContext,
} from '../../../rest/PersonaAPI';
import ContextCenterAIContextPage from './ContextCenterAIContextPage';

const mockNavigate = jest.fn();

jest.mock('../../../rest/PersonaAPI', () => ({
  getAllPersonas: jest.fn(),
  getPersonaAIContextStatus: jest.fn(),
  updatePersonaAIContext: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockAuth = { isAdminUser: true };
const mockHandlePageChange = jest.fn();
const mockPaging = {
  currentPage: 1,
  handlePageChange: mockHandlePageChange,
  handlePageSizeChange: jest.fn(),
  handlePagingChange: jest.fn(),
  pageSize: 15,
  paging: { total: 0 } as { after?: string; total: number },
  pagingCursor: {} as { cursorType?: string; cursorValue?: string },
  showPagination: false,
};

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => mockPaging,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('../../../components/common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock(
  '../../../components/common/DocumentTitle/DocumentTitle',
  () => () => null
);

jest.mock(
  '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component',
  () => () => <div data-testid="context-center-header" />
);

const personas: Persona[] = [
  {
    contextDefinition: {
      rules: [
        { entityType: 'table', filteredInSearch: true, name: 'Finance' },
        { entityType: 'table', name: 'Preloaded' },
      ],
    },
    description: 'Finance persona',
    fullyQualifiedName: 'DataEngineer',
    id: '11111111-1111-4111-8111-111111111111',
    name: 'DataEngineer',
  } as Persona,
];

describe('ContextCenterAIContextPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.isAdminUser = true;
    mockPaging.paging = { total: 0 };
    mockPaging.currentPage = 1;
    mockPaging.pagingCursor = {};
    mockPaging.showPagination = false;
    (getPersonaAIContextStatus as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('renders users, rules, entities, budget and freshness from the persona and its cache status', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({
      data: [
        {
          ...personas[0],
          users: [
            { id: 'u1', type: 'user' },
            { id: 'u2', type: 'user' },
          ],
        },
      ],
    });
    (getPersonaAIContextStatus as jest.Mock).mockResolvedValue({
      data: [
        {
          cacheState: CacheState.Fresh,
          entitiesIncluded: 64,
          lastGeneratedAt: Date.now(),
          personaId: personas[0].id,
          tokensEst: 21700,
        },
      ],
    });

    render(<ContextCenterAIContextPage />);

    const row = await screen.findByTestId('ai-context-persona-DataEngineer');

    expect(row).toHaveTextContent('2');
    expect(row).toHaveTextContent('64');
    expect(row).toHaveTextContent('message.persona-context-budget-usage');
    expect(row).toHaveTextContent('label.freshness-with-time');
  });

  it('does not request cache status for non-admins', async () => {
    mockAuth.isAdminUser = false;
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: personas });

    render(<ContextCenterAIContextPage />);

    expect(
      await screen.findByTestId('ai-context-persona-DataEngineer')
    ).toBeInTheDocument();
    expect(getPersonaAIContextStatus).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('ai-context-persona-enabled-DataEngineer')
    ).toHaveAttribute('data-disabled', 'true');
  });

  it('persists the enabled toggle and reverts it when the update fails', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: personas });
    (updatePersonaAIContext as jest.Mock).mockRejectedValue(new Error('nope'));

    render(<ContextCenterAIContextPage />);

    const toggle = await screen.findByTestId(
      'ai-context-persona-enabled-DataEngineer'
    );
    const input = toggle.querySelector('input') as HTMLInputElement;

    expect(input.checked).toBe(true);

    fireEvent.click(input);

    expect(updatePersonaAIContext).toHaveBeenCalledWith(personas[0].id, {
      cacheTtlMinutes: 30,
      characterBudget: 400000,
      enabled: false,
    });

    await waitFor(() => expect(input.checked).toBe(true));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the persona AI context on click', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: personas });

    render(<ContextCenterAIContextPage />);
    fireEvent.click(
      await screen.findByTestId('ai-context-persona-DataEngineer')
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      '/context-center/ai-context/DataEngineer'
    );
  });

  it('renders the empty state when no persona exists', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: [] });

    render(<ContextCenterAIContextPage />);

    expect(
      await screen.findByText('message.no-persona-available')
    ).toBeVisible();
  });

  it('stores the next-page cursor with the page number', async () => {
    mockPaging.paging = { after: 'cursor-2', total: 30 };
    mockPaging.showPagination = true;
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: personas });

    render(<ContextCenterAIContextPage />);
    fireEvent.click(await screen.findByTestId('next'));

    expect(mockHandlePageChange).toHaveBeenCalledWith(2, {
      cursorType: 'after',
      cursorValue: 'cursor-2',
    });
  });

  it('restores the page from the cursor in the URL for personas and their status', async () => {
    // A reload or browser Back keeps currentPage=2 in the URL; the cursor must come with it.
    mockPaging.currentPage = 2;
    mockPaging.pagingCursor = { cursorType: 'after', cursorValue: 'cursor-2' };
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: personas });

    render(<ContextCenterAIContextPage />);

    expect(
      await screen.findByTestId('ai-context-persona-DataEngineer')
    ).toBeInTheDocument();
    expect(getAllPersonas).toHaveBeenCalledWith({
      after: 'cursor-2',
      fields: 'users,contextDefinition',
      limit: 15,
    });
    expect(getPersonaAIContextStatus).toHaveBeenCalledWith({
      after: 'cursor-2',
      limit: 15,
    });
  });
});
