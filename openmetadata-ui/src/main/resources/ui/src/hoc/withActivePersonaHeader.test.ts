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
import { InternalAxiosRequestConfig } from 'axios';
import { useApplicationStore } from '../hooks/useApplicationStore';
import {
  ACTIVE_PERSONA_HEADER,
  withActivePersonaHeader,
} from './withActivePersonaHeader';

jest.mock('../hooks/useApplicationStore');

describe('withActivePersonaHeader', () => {
  const mockGetState = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useApplicationStore.getState as jest.Mock) = mockGetState;
  });

  const createMockConfig = (): InternalAxiosRequestConfig =>
    ({ headers: {} } as InternalAxiosRequestConfig);

  it('sets the active persona id header when a persona is selected', () => {
    mockGetState.mockReturnValue({
      selectedPersona: { id: '9fb7e857-df45-42e9-b341-12d28c7b49aa' },
    });
    const config = createMockConfig();

    const result = withActivePersonaHeader(config);

    expect(result).toBe(config);
    expect(result.headers[ACTIVE_PERSONA_HEADER]).toBe(
      '9fb7e857-df45-42e9-b341-12d28c7b49aa'
    );
  });

  it('leaves the config unchanged when no persona is selected', () => {
    mockGetState.mockReturnValue({ selectedPersona: undefined });
    const config = createMockConfig();

    const result = withActivePersonaHeader(config);

    expect(result).toBe(config);
    expect(result.headers[ACTIVE_PERSONA_HEADER]).toBeUndefined();
  });
});
