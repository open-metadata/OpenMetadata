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
import { ReactNode } from 'react';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { useGlossaryTermIntakeForm } from './useGlossaryTermIntakeForm';

jest.mock('../../../rest/intakeFormsAPI', () => ({
  getIntakeFormByEntityType: jest.fn(),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const INTAKE_FORM = {
  id: 'intake-form-id',
  name: 'glossaryTermIntakeForm',
  entityType: TargetEntityType.GlossaryTerm,
  requiredFields: [
    {
      fieldPath: 'displayName',
      fieldLabel: 'Display Name',
      fieldKind: FieldKind.Native,
    },
  ],
} as IntakeForm;

const mockGetIntakeForm = getIntakeFormByEntityType as jest.Mock;
const mockGetCustomProperties = getCustomPropertiesByEntityType as jest.Mock;

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe('useGlossaryTermIntakeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIntakeForm.mockResolvedValue(INTAKE_FORM);
    mockGetCustomProperties.mockResolvedValue([]);
  });

  it('fetches nothing in edit mode', () => {
    const { result } = renderHook(() => useGlossaryTermIntakeForm(true), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.isLoaded).toBe(true);
    expect(mockGetIntakeForm).not.toHaveBeenCalled();
    expect(mockGetCustomProperties).not.toHaveBeenCalled();
  });

  it('exposes the native fields the intake form makes required', async () => {
    const { result } = renderHook(() => useGlossaryTermIntakeForm(false), {
      wrapper: createWrapper(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect([...result.current.requiredNativeFields.keys()]).toEqual([
      'displayName',
    ]);
  });

  it('reuses the cached intake form when the drawer opens again', async () => {
    const wrapper = createWrapper(new QueryClient());
    const first = renderHook(() => useGlossaryTermIntakeForm(false), {
      wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoaded).toBe(true));
    first.unmount();

    const second = renderHook(() => useGlossaryTermIntakeForm(false), {
      wrapper,
    });

    // Ready on the first render, before any refetch settles.
    expect(second.result.current.isLoaded).toBe(true);
    expect([...second.result.current.requiredNativeFields.keys()]).toEqual([
      'displayName',
    ]);
  });
});
