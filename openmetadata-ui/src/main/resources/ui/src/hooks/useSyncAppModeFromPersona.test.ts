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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import { AppMode } from '../generated/type/personaPreferences';
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

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
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
          {
            personaId: 'persona-1',
            personaName: 'analytics',
            appMode: AppMode.AI,
          },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(getDocumentByFQN).not.toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('does nothing when the user has no default persona', async () => {
    seedRegistry(true);
    seedPersona(undefined);

    renderHook(() => useSyncAppModeFromPersona(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(getDocumentByFQN).not.toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('force-writes the AI runtime mode when the persona picks AppMode.AI', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          {
            personaId: 'persona-1',
            personaName: 'analytics',
            appMode: AppMode.AI,
          },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalledWith('persona.analytics');
      expect(useAppModeStore.getState().currentMode).toBe(AI_APP_MODE);
    });
  });

  it('force-writes DEFAULT_APP_MODE when the persona picks AppMode.Classic', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    useAppModeStore.setState({ currentMode: AI_APP_MODE });
    getDocumentByFQN.mockResolvedValue({
      data: {
        personaPreferences: [
          {
            personaId: 'persona-1',
            personaName: 'analytics',
            appMode: AppMode.Classic,
          },
        ],
      },
    });

    renderHook(() => useSyncAppModeFromPersona(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
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

    renderHook(() => useSyncAppModeFromPersona(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(getDocumentByFQN).toHaveBeenCalled();
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });

  it('swallows fetch errors and leaves the store unchanged', async () => {
    seedRegistry(true);
    seedPersona('persona-1', 'analytics');
    getDocumentByFQN.mockRejectedValue(new Error('boom'));

    renderHook(() => useSyncAppModeFromPersona(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useAppModeStore.getState().currentMode).toBe(DEFAULT_APP_MODE);
    });
  });
});
