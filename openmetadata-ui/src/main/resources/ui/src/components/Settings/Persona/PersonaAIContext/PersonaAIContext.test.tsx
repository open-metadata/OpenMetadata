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
import {
  getPersonaAIContext,
  updatePersonaAIContext,
} from '../../../../rest/PersonaAPI';
import { PersonaAIContext } from './PersonaAIContext.component';

jest.mock('../../../../rest/PersonaAPI', () => ({
  createPersonaAIContextRule: jest.fn(),
  deletePersonaAIContextRule: jest.fn(),
  getPersonaAIContext: jest.fn(),
  updatePersonaAIContext: jest.fn(),
  updatePersonaAIContextRule: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./ContextRuleEditor/ContextRuleEditor.component', () => ({
  ContextRuleEditor: () => null,
}));

jest.mock('./ContextPreviewModal/ContextPreviewModal.component', () => ({
  ContextPreviewModal: () => null,
}));

const mockedGetPersonaAIContext = getPersonaAIContext as jest.MockedFunction<
  typeof getPersonaAIContext
>;
const mockedUpdatePersonaAIContext =
  updatePersonaAIContext as jest.MockedFunction<typeof updatePersonaAIContext>;

describe('PersonaAIContext', () => {
  const persona = {
    contextDefinition: { rules: [] },
    id: '11111111-1111-1111-1111-111111111111',
    name: 'businessAnalyst',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPersonaAIContext.mockResolvedValue({ rules: [] });
  });

  it('renders the empty state without mutation actions for read-only users', async () => {
    render(<PersonaAIContext canEdit={false} persona={persona} />);

    expect(
      await screen.findByText('message.no-ai-context-rules')
    ).toBeInTheDocument();
    expect(screen.getByText('label.preview-context')).toBeInTheDocument();
    expect(screen.queryByText('label.add-rule')).not.toBeInTheDocument();
  });

  it('shows rule creation actions to editors', async () => {
    render(<PersonaAIContext canEdit persona={persona} />);

    expect(await screen.findAllByText('label.add-rule')).toHaveLength(2);
  });

  it('persists an explicit disabled state', async () => {
    const definition = {
      cacheTtlMinutes: 30,
      characterBudget: 150000,
      enabled: true,
      rules: [
        {
          entityType: 'table',
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Tables',
        },
      ],
    };
    mockedGetPersonaAIContext.mockResolvedValue(definition);
    mockedUpdatePersonaAIContext.mockResolvedValue({
      ...definition,
      enabled: false,
    });

    render(<PersonaAIContext canEdit persona={persona} />);

    const enabledSwitch = await screen.findByTestId('persona-context-enabled');
    fireEvent.click(enabledSwitch);

    await waitFor(() =>
      expect(mockedUpdatePersonaAIContext).toHaveBeenCalledWith(persona.id, {
        cacheTtlMinutes: 30,
        characterBudget: 150000,
        enabled: false,
      })
    );
  });
});
