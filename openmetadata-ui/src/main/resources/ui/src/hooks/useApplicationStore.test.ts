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

import { act } from 'react';
import { useApplicationStore } from './useApplicationStore';

// Focused coverage for `applicationsLoaded` — the gate that downstream
// effects (e.g. Collate's AI-mode register/unregister) rely on to avoid
// firing against an empty `applications` array before
// `ApplicationsProvider`'s fetch resolves.
describe('useApplicationStore.applicationsLoaded', () => {
  beforeEach(() => {
    act(() => {
      useApplicationStore.setState({
        applications: [],
        applicationsLoaded: false,
      });
    });
  });

  it('defaults applicationsLoaded to false on initial state', () => {
    expect(useApplicationStore.getState().applicationsLoaded).toBe(false);
  });

  it('flips applicationsLoaded via setApplicationsLoaded(true)', () => {
    act(() => {
      useApplicationStore.getState().setApplicationsLoaded(true);
    });

    expect(useApplicationStore.getState().applicationsLoaded).toBe(true);
  });

  it('can flip back to false via setApplicationsLoaded(false)', () => {
    act(() => {
      useApplicationStore.getState().setApplicationsLoaded(true);
      useApplicationStore.getState().setApplicationsLoaded(false);
    });

    expect(useApplicationStore.getState().applicationsLoaded).toBe(false);
  });

  it('keeps applications and applicationsLoaded as independent fields', () => {
    act(() => {
      useApplicationStore.getState().setApplicationsName(['SomeApp']);
    });

    expect(useApplicationStore.getState().applications).toEqual(['SomeApp']);
    // The loaded gate is NOT flipped just because applications was set —
    // ApplicationsProvider is the only writer that gets to flip it after
    // the fetch finally resolves.
    expect(useApplicationStore.getState().applicationsLoaded).toBe(false);
  });
});
