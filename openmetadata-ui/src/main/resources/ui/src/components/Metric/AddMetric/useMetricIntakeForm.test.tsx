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
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { FieldKind } from '../../../generated/governance/intakeForm';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { useMetricIntakeForm } from './useMetricIntakeForm';

jest.mock('../../../rest/intakeFormsAPI', () => ({
  getIntakeFormByEntityType: jest.fn(),
}));
jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
}));
const getForm = getIntakeFormByEntityType as jest.Mock;
const getProperties = getCustomPropertiesByEntityType as jest.Mock;
const wrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
};

beforeEach(() => {
  jest.resetAllMocks();
  getForm.mockResolvedValue(null);
  getProperties.mockResolvedValue([]);
});

it('does not fetch before the create drawer opens', () => {
  renderHook(() => useMetricIntakeForm(false), { wrapper: wrapper() });

  expect(getForm).not.toHaveBeenCalled();
  expect(getProperties).not.toHaveBeenCalled();
});

it('preserves ordinary metric creation when there is no enabled intake form', async () => {
  const { result } = renderHook(() => useMetricIntakeForm(true), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));

  expect(getForm).toHaveBeenCalledWith('metric');
  expect(result.current.requiredNativeFields.size).toBe(0);
  expect(result.current.extensionFormFields).toEqual([]);
});

it('separates required native fields from optional and required custom fields', async () => {
  const fields = [
    { fieldPath: 'owners', fieldKind: FieldKind.Native, required: true },
    { fieldPath: 'displayName', fieldKind: FieldKind.Native, required: false },
    {
      fieldPath: 'extension.risk',
      fieldKind: FieldKind.CustomProperty,
      required: true,
    },
    {
      fieldPath: 'extension.source',
      fieldKind: FieldKind.CustomProperty,
      required: false,
    },
  ];
  getForm.mockResolvedValue({ formFields: fields });
  const { result } = renderHook(() => useMetricIntakeForm(true), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));

  expect([...result.current.requiredNativeFields.keys()]).toEqual(['owners']);
  expect(result.current.extensionFormFields).toEqual(fields.slice(2));
});

it('accepts legacy requiredFields configurations', async () => {
  getForm.mockResolvedValue({
    requiredFields: [{ fieldPath: 'reviewers', fieldKind: FieldKind.Native }],
  });
  const { result } = renderHook(() => useMetricIntakeForm(true), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));

  expect(result.current.requiredNativeFields.get('reviewers')?.required).toBe(
    true
  );
});

it.each(['form', 'properties'])(
  'blocks submission if %s fails, and supports retry',
  async (failed) => {
    (failed === 'form' ? getForm : getProperties).mockRejectedValueOnce(
      new Error('Unavailable')
    );
    const { result } = renderHook(() => useMetricIntakeForm(true), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.isError).toBe(false);
  }
);

it('waits for custom-property definitions even when the intake form is ready', async () => {
  let resolveProperties!: (properties: never[]) => void;
  getProperties.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveProperties = resolve;
      })
  );
  const { result } = renderHook(() => useMetricIntakeForm(true), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(getForm).toHaveBeenCalled());

  expect(result.current.isLoaded).toBe(false);

  await act(async () => {
    resolveProperties([]);
  });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
});

it('refetches changed requirements on reopening and blocks while they load', async () => {
  const provider = wrapper();
  const first = renderHook(() => useMetricIntakeForm(true), {
    wrapper: provider,
  });
  await waitFor(() => expect(first.result.current.isLoaded).toBe(true));
  first.unmount();
  getForm.mockResolvedValue({
    requiredFields: [{ fieldPath: 'owners', fieldKind: FieldKind.Native }],
  });
  const second = renderHook(() => useMetricIntakeForm(true), {
    wrapper: provider,
  });

  expect(second.result.current.isLoaded).toBe(false);

  await waitFor(() =>
    expect(second.result.current.requiredNativeFields.has('owners')).toBe(true)
  );
  await waitFor(() => expect(second.result.current.isLoaded).toBe(true));
});
