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
import { act, useEffect } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppModule } from '../AppModule.types';

// The module list is contributed at runtime (OSS modules + plugin modules), so
// the hook is exercised against a fixed fixture rather than whatever happens to
// be registered.
const MODULES = [
  {
    id: 'observability',
    navOrder: 1,
    labelKey: 'label.observability',
    prefix: '/observability',
    routes: [],
  },
  {
    id: 'connections',
    navOrder: 2,
    labelKey: 'label.connection-plural',
    prefix: '/connections',
    routes: [],
  },
  {
    id: 'governance',
    navOrder: 3,
    labelKey: 'label.governance',
    prefix: '/governance',
    additionalPrefixes: ['/tags', '/metrics', '/workflows'],
    routes: [],
  },
] as unknown as AppModule[];

jest.mock('../sharedAppModules', () => ({
  useAllAppModules: () => MODULES,
}));

import {
  matchModuleByPathname,
  useActiveModuleStore,
  useSyncActiveModule,
} from './useActiveModule';

describe('matchModuleByPathname', () => {
  it('returns the module id when the pathname matches a module prefix exactly', () => {
    expect(matchModuleByPathname('/observability', MODULES)).toBe(
      'observability'
    );
    expect(matchModuleByPathname('/connections', MODULES)).toBe('connections');
  });

  it('returns the module id when the pathname is nested under a module prefix', () => {
    expect(matchModuleByPathname('/observability/data-quality', MODULES)).toBe(
      'observability'
    );
    expect(
      matchModuleByPathname('/connections/database/foo.bar', MODULES)
    ).toBe('connections');
  });

  it('returns null when the pathname is module-less (shared / unrelated)', () => {
    expect(matchModuleByPathname('/conversations/abc', MODULES)).toBeNull();
    expect(matchModuleByPathname('/table/some.fqn', MODULES)).toBeNull();
    expect(matchModuleByPathname('/', MODULES)).toBeNull();
  });

  it('matches a module via its additional prefixes', () => {
    expect(matchModuleByPathname('/tags', MODULES)).toBe('governance');
    expect(matchModuleByPathname('/metrics', MODULES)).toBe('governance');
    expect(matchModuleByPathname('/governance/ontology', MODULES)).toBe(
      'governance'
    );
    expect(matchModuleByPathname('/workflows', MODULES)).toBe('governance');
  });

  it('does not match a sibling pathname that merely shares the prefix string', () => {
    expect(
      matchModuleByPathname('/observability-archived', MODULES)
    ).toBeNull();
    expect(matchModuleByPathname('/connectionsx', MODULES)).toBeNull();
  });

  it('returns null when no modules are contributed', () => {
    expect(matchModuleByPathname('/observability', [])).toBeNull();
  });
});

const Harness = () => {
  useSyncActiveModule();

  return null;
};

const Navigator = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);

  return null;
};

const NavigateButton = ({ to }: { to: string }) => {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(to)}>
      navigate
    </button>
  );
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>
  );

describe('useSyncActiveModule', () => {
  beforeEach(() => {
    act(() => {
      useActiveModuleStore.setState({ activeModule: 'observability' });
    });
  });

  it('clears the active module on mount so stale state does not survive a mode-switch', () => {
    renderAt('/conversations/abc');

    expect(useActiveModuleStore.getState().activeModule).toBeNull();
  });

  it('sets the active module from the URL when the pathname matches a module prefix', () => {
    renderAt('/connections/database/foo');

    expect(useActiveModuleStore.getState().activeModule).toBe('connections');
  });

  it('leaves the previous module untouched (sticky) when navigating to a shared entity page', () => {
    render(
      <MemoryRouter initialEntries={['/observability/data-quality']}>
        <Harness />
        <Navigator to="/table/some.fqn" />
      </MemoryRouter>
    );

    expect(useActiveModuleStore.getState().activeModule).toBe('observability');
  });

  it('clears the module on Home, which is matched exactly and not by prefix', () => {
    render(
      <MemoryRouter initialEntries={['/observability/data-quality']}>
        <Harness />
        <NavigateButton to="/" />
      </MemoryRouter>
    );

    expect(useActiveModuleStore.getState().activeModule).toBe('observability');

    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    expect(useActiveModuleStore.getState().activeModule).toBeNull();
  });

  it('clears the module on Explore, a module-less top-level nav route', () => {
    render(
      <MemoryRouter initialEntries={['/observability/data-quality']}>
        <Harness />
        <NavigateButton to="/explore" />
      </MemoryRouter>
    );

    expect(useActiveModuleStore.getState().activeModule).toBe('observability');

    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    expect(useActiveModuleStore.getState().activeModule).toBeNull();
  });

  it('clears the module on Settings', () => {
    render(
      <MemoryRouter initialEntries={['/observability/data-quality']}>
        <Harness />
        <NavigateButton to="/settings" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    expect(useActiveModuleStore.getState().activeModule).toBeNull();
  });
});
