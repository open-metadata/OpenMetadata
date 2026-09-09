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
import { fireEvent, render, screen } from '@testing-library/react';
import { Persona } from '../../../generated/entity/teams/persona';
import { getAllPersonas } from '../../../rest/PersonaAPI';
import ContextCenterAIContextPage from './ContextCenterAIContextPage';

const mockNavigate = jest.fn();

jest.mock('../../../rest/PersonaAPI', () => ({
  getAllPersonas: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
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
  });

  it('lists personas with their rule and scoped-rule counts', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({ data: personas });

    render(<ContextCenterAIContextPage />);

    expect(
      await screen.findByTestId('ai-context-persona-DataEngineer')
    ).toBeInTheDocument();
    expect(screen.getByText('label.entity-count-rule-plural')).toBeVisible();
    expect(
      screen.getByText('label.entity-count-filtered-in-search')
    ).toBeVisible();
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
});
