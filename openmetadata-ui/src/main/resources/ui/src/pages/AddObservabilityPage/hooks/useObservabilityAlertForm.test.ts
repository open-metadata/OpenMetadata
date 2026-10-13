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
import { ModifiedCreateEventSubscription } from '../AddObservabilityPage.interface';
import { useObservabilityAlertForm } from './useObservabilityAlertForm';

const mockGetResourceLimit = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: mockGetResourceLimit }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ getResourcePermission: jest.fn() }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ setInlineAlertDetails: jest.fn() }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: '' }),
}));

jest.mock('../../../rest/observabilityAPI', () => ({
  createObservabilityAlert: jest.fn(),
  getObservabilityAlertByFQN: jest.fn().mockResolvedValue({}),
  updateObservabilityAlert: jest.fn(),
}));

jest.mock('../../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: {
    getAddAlertFormExtraButtons: () => ({}),
    getAddAlertFormExtraWidgets: () => ({}),
    getModifiedAlertDataForForm: (alert: unknown) => alert,
    handleAlertSave: ({
      afterSaveAction,
    }: {
      afterSaveAction: (fqn: string) => Promise<void>;
    }) => afterSaveAction('saved.alert'),
  },
}));

jest.mock('./useAlertResources', () => ({
  useAlertResources: () => ({ loading: false }),
}));

jest.mock('./useObservabilityAlertTemplates', () => ({
  useObservabilityAlertTemplates: () => ({ loading: false }),
}));

describe('useObservabilityAlertForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refreshes the alert limit after create even when the caller handles navigation', async () => {
    const afterSaveAction = jest.fn();
    const { result } = renderHook(() =>
      useObservabilityAlertForm({ afterSaveAction })
    );

    await act(async () => {
      await result.current.handleSave({} as ModifiedCreateEventSubscription);
    });

    expect(mockGetResourceLimit).toHaveBeenCalledWith(
      'eventsubscription',
      true,
      true
    );
    expect(afterSaveAction).toHaveBeenCalledWith('saved.alert');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not refresh the alert limit when editing', async () => {
    const { result } = renderHook(() =>
      useObservabilityAlertForm({ afterSaveAction: jest.fn(), fqn: 'a.b' })
    );

    await act(async () => {
      await result.current.handleSave({} as ModifiedCreateEventSubscription);
    });

    expect(mockGetResourceLimit).not.toHaveBeenCalled();
  });
});
