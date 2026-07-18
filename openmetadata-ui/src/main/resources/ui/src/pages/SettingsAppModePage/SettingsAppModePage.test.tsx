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
import { Persona } from '../../generated/entity/teams/persona';
import { AppMode } from '../../generated/type/personaPreferences';
import { useAppRoutesRegistry } from '../../hooks/useAppRoutesRegistry';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import { SettingsAppModePage } from './SettingsAppModePage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader',
  () => ({
    CustomizablePageHeader: ({
      onSave,
      onReset,
      disableSave,
    }: {
      onSave: () => void;
      onReset: () => void;
      disableSave: boolean;
    }) => (
      <div>
        <button data-testid="save-btn" disabled={disableSave} onClick={onSave}>
          save
        </button>
        <button data-testid="reset-btn" onClick={onReset}>
          reset
        </button>
      </div>
    ),
  })
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock(
  '../../components/common/NavigationBlocker/NavigationBlocker',
  () => ({
    NavigationBlocker: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);

const personaId = 'persona-1';
const persona = { id: personaId, name: 'analytics' } as Persona;

const seedDoc = (appMode?: AppMode) => {
  useCustomizeStore.setState({
    document: {
      id: 'doc-1',
      name: 'persona.analytics',
      fullyQualifiedName: 'persona.analytics',
      entityType: 'persona',
      data: {
        personaPreferences: [{ personaId, personaName: 'analytics', appMode }],
      },
    } as never,
  });
};

describe('SettingsAppModePage', () => {
  beforeEach(() => {
    useAppRoutesRegistry.setState({
      routes: { ai: (() => null) as never },
    });
    seedDoc(undefined);
  });

  it('renders Classic and AI as the only options', () => {
    render(<SettingsAppModePage personaDetails={persona} onSave={jest.fn()} />);

    expect(
      screen.getByTestId(`app-mode-option-${AppMode.Classic}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`app-mode-option-${AppMode.AI}`)
    ).toBeInTheDocument();
  });

  it('selects the persisted appMode on mount', () => {
    seedDoc(AppMode.AI);
    render(<SettingsAppModePage personaDetails={persona} onSave={jest.fn()} />);

    const aiOption = screen.getByTestId(
      `app-mode-option-${AppMode.AI}`
    ) as HTMLInputElement;

    expect(aiOption.checked).toBe(true);
  });

  it('falls back to Classic when the persona has no appMode', () => {
    render(<SettingsAppModePage personaDetails={persona} onSave={jest.fn()} />);

    const classicOption = screen.getByTestId(
      `app-mode-option-${AppMode.Classic}`
    ) as HTMLInputElement;

    expect(classicOption.checked).toBe(true);
  });

  it('disables save when selection equals persisted value', () => {
    seedDoc(AppMode.AI);
    render(<SettingsAppModePage personaDetails={persona} onSave={jest.fn()} />);

    expect((screen.getByTestId('save-btn') as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('enables save and calls onSave with the selected AppMode enum value', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<SettingsAppModePage personaDetails={persona} onSave={onSave} />);

    fireEvent.click(screen.getByTestId(`app-mode-option-${AppMode.AI}`));
    fireEvent.click(screen.getByTestId('save-btn'));

    expect(onSave).toHaveBeenCalledWith(AppMode.AI);
  });

  it('reset returns the selection to Classic', () => {
    seedDoc(AppMode.AI);
    render(<SettingsAppModePage personaDetails={persona} onSave={jest.fn()} />);

    fireEvent.click(screen.getByTestId('reset-btn'));
    const classicOption = screen.getByTestId(
      `app-mode-option-${AppMode.Classic}`
    ) as HTMLInputElement;

    expect(classicOption.checked).toBe(true);
  });

  it('shows the unavailable placeholder when no non-default mode is registered', () => {
    useAppRoutesRegistry.setState({ routes: {} });
    render(<SettingsAppModePage personaDetails={persona} onSave={jest.fn()} />);

    expect(
      screen.getByTestId('app-mode-unavailable-placeholder')
    ).toBeInTheDocument();
  });
});
