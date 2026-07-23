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

import { act, ComponentType } from 'react';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';

const FakeRoutes: ComponentType = () => null;
const OtherRoutes: ComponentType = () => null;

describe('useAppRoutesRegistry', () => {
  beforeEach(() => {
    // Reset the store between tests — Zustand singletons persist
    // module-load state otherwise.
    act(() => {
      useAppRoutesRegistry.setState({ routes: {} });
    });
  });

  it('registers a routes component under a mode key', () => {
    expect(useAppRoutesRegistry.getState().routes).toEqual({});

    act(() => {
      useAppRoutesRegistry.getState().registerRoutes('ai', FakeRoutes);
    });

    expect(useAppRoutesRegistry.getState().routes).toEqual({ ai: FakeRoutes });
  });

  it('overwrites an existing registration when called twice with the same mode', () => {
    act(() => {
      useAppRoutesRegistry.getState().registerRoutes('ai', FakeRoutes);
      useAppRoutesRegistry.getState().registerRoutes('ai', OtherRoutes);
    });

    expect(useAppRoutesRegistry.getState().routes.ai).toBe(OtherRoutes);
  });

  it('unregisters a previously-registered mode', () => {
    act(() => {
      useAppRoutesRegistry.getState().registerRoutes('ai', FakeRoutes);
    });

    expect(useAppRoutesRegistry.getState().routes).toHaveProperty('ai');

    act(() => {
      useAppRoutesRegistry.getState().unregisterRoutes('ai');
    });

    expect(useAppRoutesRegistry.getState().routes).not.toHaveProperty('ai');
    expect(useAppRoutesRegistry.getState().routes).toEqual({});
  });

  it('leaves other registered modes intact when unregistering one', () => {
    act(() => {
      useAppRoutesRegistry.getState().registerRoutes('ai', FakeRoutes);
      useAppRoutesRegistry.getState().registerRoutes('preview', OtherRoutes);
    });

    act(() => {
      useAppRoutesRegistry.getState().unregisterRoutes('ai');
    });

    expect(useAppRoutesRegistry.getState().routes).toEqual({
      preview: OtherRoutes,
    });
  });

  it('is a no-op when unregistering a mode that was never registered', () => {
    const before = useAppRoutesRegistry.getState().routes;

    act(() => {
      useAppRoutesRegistry.getState().unregisterRoutes('nothing-here');
    });

    // Reference identity should be preserved so consumers don't
    // re-render on a no-op unregister.
    expect(useAppRoutesRegistry.getState().routes).toBe(before);
  });
});
