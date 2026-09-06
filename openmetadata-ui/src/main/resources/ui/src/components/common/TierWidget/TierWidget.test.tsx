/*
 *  Copyright 2025 Collate.
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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Operation } from '../../../generated/entity/policies/policy';
import { TagLabel } from '../../../generated/type/tagLabel';
import TierWidget from './TierWidget';

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));
jest.mock('../../../rest/tagAPI', () => ({ getTags: jest.fn() }));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const tier1 = {
  id: 'tier-1-id',
  name: 'Tier1',
  fullyQualifiedName: 'Tier.Tier1',
  description: 'Tier 1 short description\n\nTier 1 long description body',
  version: 0.1,
  updatedAt: 1665646906357,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/tags/Tier/Tier1',
  deprecated: false,
  deleted: false,
};
const tier3 = {
  id: 'tier-3-id',
  name: 'Tier3',
  fullyQualifiedName: 'Tier.Tier3',
  description: 'Tier 3 short description\n\nTier 3 long description body',
  version: 0.1,
  updatedAt: 1665646906357,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/tags/Tier/Tier3',
  deprecated: false,
  deleted: false,
};

const { getTags } = require('../../../rest/tagAPI') as {
  getTags: jest.Mock;
};
const { useGenericContext } =
  require('../../Customization/GenericProvider/GenericContext') as {
    useGenericContext: jest.Mock;
  };

const entity = {
  id: 'domain-1',
  name: 'Marketing',
  fullyQualifiedName: 'Marketing',
  description: 'A domain',
  tags: [
    {
      tagFQN: 'Tier.Tier1',
      name: 'Tier1',
      displayName: 'Tier1',
      description: 'Tier 1',
      labelType: 'Manual',
      source: 'Classification',
      state: 'Confirmed',
    } as TagLabel,
  ],
};
const onUpdate = jest.fn().mockResolvedValue(undefined);

describe('TierWidget tier editor', () => {
  beforeEach(() => {
    jest.useRealTimers();
    getTags.mockImplementation(() => Promise.resolve({ data: [tier1, tier3] }));
    useGenericContext.mockReturnValue({
      data: entity,
      permissions: { [Operation.EditTier]: true } as unknown,
      onUpdate,
      isVersionView: false,
    });
  });

  afterAll(() => {
    jest.useFakeTimers();
  });

  it('discards a cancelled selection across close/reopen and commits the persisted tier on Update', async () => {
    render(
      <MemoryRouter>
        <TierWidget />
      </MemoryRouter>
    );
    const editTier = await screen.findByTestId('edit-tier');
    await act(async () => {
      fireEvent.click(editTier);
    });

    const radioTier3 = await screen.findByTestId('radio-btn-Tier3');

    expect(radioTier3).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(radioTier3);
    });

    const closeBtn = await screen.findByTestId('close-tier-card');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // TierCard stays mounted across close/reopen because the entity already
    // has a tier, so any uncommitted radio selection would otherwise survive.
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-tier'));
    });

    const updateBtn = await screen.findByTestId('update-tier-card');
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    // The persisted tier (Tier.Tier1) is committed, not the cancelled Tier3.
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining([
          expect.objectContaining({ tagFQN: 'Tier.Tier1' }),
        ]),
      })
    );
    expect(onUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining([
          expect.objectContaining({ tagFQN: 'Tier.Tier3' }),
        ]),
      })
    );
  });
});
