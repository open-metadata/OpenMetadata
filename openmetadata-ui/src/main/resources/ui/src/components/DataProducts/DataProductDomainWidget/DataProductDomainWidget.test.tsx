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

import { act, render, waitFor } from '@testing-library/react';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { DataProductDomainWidget } from './DataProductDomainWidget';

const mockOnUpdate = jest.fn().mockResolvedValue(undefined);
const mockPatchDataProduct = jest.fn();

let capturedOnUpdate:
  | ((d: EntityReference | EntityReference[]) => Promise<void> | void)
  | undefined;

const mockDataProduct: DataProduct = {
  id: 'dp-1',
  name: 'dp_one',
  displayName: 'DP One',
  fullyQualifiedName: 'dp_one',
  description: 'test',
  version: 0.1,
  updatedAt: 1,
  updatedBy: 'tester',
  domains: [
    {
      id: 'dom-source',
      type: 'domain',
      name: 'source',
      fullyQualifiedName: 'source',
    },
  ],
};

jest.mock('../../../rest/dataProductAPI', () => ({
  patchDataProduct: (...args: unknown[]) => mockPatchDataProduct(...args),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { total: { value: 0 } } }),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: () => ({
    data: mockDataProduct,
    onUpdate: mockOnUpdate,
  }),
}));

jest.mock('../../DataAssets/DomainLabelV2/DomainLabelV2', () => ({
  DomainLabelV2: jest.fn().mockImplementation((props) => {
    capturedOnUpdate = props.onUpdate;

    return <div data-testid="mock-domain-label" />;
  }),
}));

describe('DataProductDomainWidget', () => {
  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockPatchDataProduct.mockClear();
    capturedOnUpdate = undefined;
  });

  it('delegates domain change to onUpdate without self-patching', async () => {
    render(<DataProductDomainWidget />);

    await waitFor(() => expect(capturedOnUpdate).toBeDefined());

    const newDomain: EntityReference = {
      id: 'dom-target',
      type: 'domain',
      name: 'target',
      fullyQualifiedName: 'target',
      displayName: 'Target',
      description: 'should be stripped',
      href: 'http://ignored',
      deleted: false,
      inherited: false,
    };

    await act(async () => {
      await capturedOnUpdate?.(newDomain);
    });

    expect(mockPatchDataProduct).not.toHaveBeenCalled();
    expect(mockOnUpdate).toHaveBeenCalledTimes(1);

    const payload = mockOnUpdate.mock.calls[0][0] as DataProduct;

    expect(payload.id).toBe(mockDataProduct.id);
    expect(payload.domains).toEqual([
      {
        id: 'dom-target',
        type: 'domain',
        name: 'target',
        fullyQualifiedName: 'target',
      },
    ]);
  });

  it('passes empty domains array when selection is cleared', async () => {
    render(<DataProductDomainWidget />);

    await waitFor(() => expect(capturedOnUpdate).toBeDefined());

    await act(async () => {
      await capturedOnUpdate?.([]);
    });

    expect(mockPatchDataProduct).not.toHaveBeenCalled();
    expect(mockOnUpdate).toHaveBeenCalledTimes(1);

    const payload = mockOnUpdate.mock.calls[0][0] as DataProduct;

    expect(payload.domains).toEqual([]);
  });

  it('rethrows errors from onUpdate so callers can prevent optimistic UI updates', async () => {
    const updateError = new Error('PATCH failed');
    mockOnUpdate.mockRejectedValueOnce(updateError);

    render(<DataProductDomainWidget />);

    await waitFor(() => expect(capturedOnUpdate).toBeDefined());

    const newDomain: EntityReference = {
      id: 'dom-target',
      type: 'domain',
      name: 'target',
      fullyQualifiedName: 'target',
    };

    await expect(
      act(async () => {
        await capturedOnUpdate?.(newDomain);
      })
    ).rejects.toThrow('PATCH failed');
  });
});
