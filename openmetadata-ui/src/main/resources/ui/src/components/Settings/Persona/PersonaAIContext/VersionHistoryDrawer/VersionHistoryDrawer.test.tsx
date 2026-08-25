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
import { EntityType } from '../../../../../enums/entity.enum';
import {
  getPersonaVersions,
  updatePersona,
} from '../../../../../rest/PersonaAPI';
import { VersionHistoryDrawer } from './VersionHistoryDrawer.component';

jest.mock('../../../../../rest/PersonaAPI', () => ({
  getPersonaVersions: jest.fn(),
  refreshPersonaAIContextDocument: jest.fn(),
  updatePersona: jest.fn(),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

jest.mock('../../../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

const snapshot = (version: number, contextDefinition: unknown) =>
  JSON.stringify({
    id: 'p1',
    version,
    updatedBy: 'harsha',
    updatedAt: version * 1000,
    contextDefinition,
  });

const rule = { id: 'r1', name: 'KPI metrics', entityType: EntityType.TABLE };

const mockedGetPersonaVersions = getPersonaVersions as jest.MockedFunction<
  typeof getPersonaVersions
>;
const mockedUpdatePersona = updatePersona as jest.MockedFunction<
  typeof updatePersona
>;

describe('VersionHistoryDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPersonaVersions.mockResolvedValue({
      entityType: 'persona',
      versions: [
        snapshot(1.2, { characterBudget: 150000, rules: [rule] }),
        snapshot(1.1, { characterBudget: 120000, rules: [] }),
      ],
    });
  });

  it('renders the version timeline newest-first with a Current badge', async () => {
    render(
      <VersionHistoryDrawer canEdit open personaId="p1" onClose={jest.fn()} />
    );

    await waitFor(() =>
      expect(mockedGetPersonaVersions).toHaveBeenCalledWith('p1')
    );

    expect(await screen.findByTestId('version-dot-1.2')).toBeInTheDocument();
    expect(screen.getByTestId('version-dot-1.1')).toBeInTheDocument();
    expect(screen.getByText('label.current')).toBeInTheDocument();
  });

  it('does not fetch versions while closed', () => {
    render(
      <VersionHistoryDrawer
        canEdit
        open={false}
        personaId="p1"
        onClose={jest.fn()}
      />
    );

    expect(mockedGetPersonaVersions).not.toHaveBeenCalled();
  });

  it('restores an older version through a confirmation step', async () => {
    mockedUpdatePersona.mockResolvedValue({} as never);
    const onRestored = jest.fn();
    render(
      <VersionHistoryDrawer
        canEdit
        open
        personaId="p1"
        onClose={jest.fn()}
        onRestored={onRestored}
      />
    );

    const restoreButton = await screen.findByTestId('restore-version-1.1');
    fireEvent.click(restoreButton);

    fireEvent.click(await screen.findByTestId('confirm-restore-version'));

    await waitFor(() => expect(mockedUpdatePersona).toHaveBeenCalledTimes(1));

    expect(mockedUpdatePersona.mock.calls[0][0]).toBe('p1');
    expect(onRestored).toHaveBeenCalled();
  });

  it('hides restore actions when the user cannot edit', async () => {
    render(
      <VersionHistoryDrawer
        open
        canEdit={false}
        personaId="p1"
        onClose={jest.fn()}
      />
    );

    await screen.findByTestId('version-dot-1.2');

    expect(screen.queryByTestId('restore-version-1.1')).not.toBeInTheDocument();
  });
});
