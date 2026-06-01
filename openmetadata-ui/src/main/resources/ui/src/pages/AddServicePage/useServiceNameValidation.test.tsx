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

import { act, renderHook } from '@testing-library/react';
import { ServiceCategory } from '../../enums/service.enum';
import { getServiceByFQN } from '../../rest/serviceAPI';
import { useServiceNameValidation } from './useServiceNameValidation';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn(),
}));

describe('useServiceNameValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats disabled and blank names as valid without calling the service API', async () => {
    const { result, rerender } = renderHook(
      ({ enabled, serviceName }: { enabled: boolean; serviceName: string }) =>
        useServiceNameValidation({
          enabled,
          serviceCategory: ServiceCategory.DATABASE_SERVICES,
          serviceName,
        }),
      {
        initialProps: {
          enabled: false,
          serviceName: 'existing-service',
        },
      }
    );

    await act(async () => {
      await expect(result.current.validateServiceName()).resolves.toBe(true);
    });

    rerender({
      enabled: true,
      serviceName: '   ',
    });

    await act(async () => {
      await expect(result.current.validateServiceName()).resolves.toBe(true);
    });

    expect(getServiceByFQN).not.toHaveBeenCalled();
    expect(result.current.isServiceNameChecking).toBe(false);
    expect(result.current.nameError).toBe('');
  });

  it('clears duplicate-name state when validation is reset', async () => {
    (getServiceByFQN as jest.Mock).mockResolvedValue({
      name: 'existing-service',
    });

    const { result } = renderHook(() =>
      useServiceNameValidation({
        enabled: true,
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceName: 'existing-service',
      })
    );

    await act(async () => {
      await expect(result.current.validateServiceName()).resolves.toBe(false);
    });

    expect(result.current.nameError).toBe(
      'message.service-name-already-exists-with-suggestion'
    );

    act(() => {
      result.current.resetNameValidation();
    });

    expect(result.current.nameError).toBe('');
    expect(result.current.isServiceNameChecking).toBe(false);
  });
});
