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

import { renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { useApplicationStore } from './useApplicationStore';
import { useAppModeStore } from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';
import { useSyncAppModeFromPersona } from './useSyncAppModeFromPersona';

jest.mock('../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

const { getDocumentByFQN } = jest.requireMock('../rest/DocStoreAPI') as {
  getDocumentByFQN: jest.Mock;
};

const seedPersona = (id?: string, name?: string) => {
  useApplicationStore.setState({
    currentUser: id
      ? ({
          id: 'user-1',
          name: 'user-1',
          defaultPersona: { id, name: name ?? 'p', type: 'persona' },
        } as unknown as ReturnType<
          typeof useApplicationStore.getState
        >['currentUser'])
      : undefined,
  });
};

const seedRegistry = (hasAi: boolean) => {
  useAppRoutesRegistry.setState({
    routes: hasAi ? { ai: (() => null) as never } : {},
  });
};

describe('useSyncAppModeFromPersona', () => {
  beforeEach(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
    seedRegistry(false);
    seedPersona(undefined);
    getDocumentByFQN.mockReset();
  });

  it('does nothing when no non-default app mode is registered', async () => {
    seedRegistry(false);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          { personaId: 'persona-1', personaName: 'analytics', appMode: 'ai' },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).not.toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('does nothing when the user has no default persona', async () => {
    seedRegistry(true);
    seedPersona(undefined);

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).not.toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('force-writes persona.appMode into useAppModeStore when present', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          { personaId: 'persona-1', personaName: 'analytics', appMode: 'ai' },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalledWith('persona.analytics');
      expect(useAppModeStore.getState().currentMode).toBe('ai');
    });
  });

  it('leaves store alone when persona has no appMode', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          { personaId: 'persona-1', personaName: 'analytics' },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('swallows fetch errors and leaves the store unchanged', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockRejectedValue(new Error('boom'));

    renderHook(() => useSyncAppModeFromPersona());

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });
});
