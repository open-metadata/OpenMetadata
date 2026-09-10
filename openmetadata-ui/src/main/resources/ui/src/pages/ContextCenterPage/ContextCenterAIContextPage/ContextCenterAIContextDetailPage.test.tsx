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
import { render, screen } from '@testing-library/react';
import { Persona } from '../../../generated/entity/teams/persona';
import { getPersonaByName } from '../../../rest/PersonaAPI';
import ContextCenterAIContextDetailPage from './ContextCenterAIContextDetailPage';

jest.mock('../../../rest/PersonaAPI', () => ({
  getPersonaByName: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'DataEngineer' }),
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

jest.mock(
  '../../../components/ContextCenter/PersonaAIContext/PersonaAIContext.component',
  () => ({
    PersonaAIContext: ({ canEdit }: { canEdit: boolean }) => (
      <div data-can-edit={canEdit} data-testid="persona-ai-context" />
    ),
  })
);

const persona = {
  fullyQualifiedName: 'DataEngineer',
  id: '11111111-1111-4111-8111-111111111111',
  name: 'DataEngineer',
} as Persona;

describe('ContextCenterAIContextDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the rule editor for the resolved persona', async () => {
    (getPersonaByName as jest.Mock).mockResolvedValue(persona);

    render(<ContextCenterAIContextDetailPage />);

    expect(await screen.findByTestId('persona-ai-context')).toHaveAttribute(
      'data-can-edit',
      'true'
    );
    expect(getPersonaByName).toHaveBeenCalledWith('DataEngineer');
  });

  it('renders the empty state when the persona cannot be loaded', async () => {
    (getPersonaByName as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<ContextCenterAIContextDetailPage />);

    expect(
      await screen.findByText('message.no-persona-available')
    ).toBeVisible();
  });
});
