/*
 *  Copyright 2022 Collate.
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
  findAllByText,
  findByTestId,
  fireEvent,
  getByText,
  render,
} from '@testing-library/react';
import React from 'react';
import TierCard from './TierCard';

const mockTierData = [
  {
    id: 'e4ec1760-79c0-4afc-a0eb-c3da339aa750',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
    description:
      '**Critical Source of Truth business data assets of an organization**',
    version: 0.1,
    updatedAt: 1665646906357,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tags/Tier/Tier1',
    deprecated: false,
    deleted: false,
  },
];

jest.mock('rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({ data: mockTierData }),
}));

jest.mock('../../cardlist/CardListItem/CardWithListItem', () => ({
  CardListItem: jest.fn().mockReturnValue(<div>CardListItem</div>),
}));

jest.mock('../../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader</div>);
});

jest.mock('../../../utils/ToastUtils', () => {
  return jest.fn().mockReturnValue(<div>showErrorToast</div>);
});

// Mock Antd components
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),

  Popover: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="tier-card-container">{children}</div>
    )),
}));

const MockOnUpdate = jest.fn();
const MockOnRemove = jest.fn();

describe.skip('Test TierCard Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <TierCard
        currentTier=""
        removeTier={MockOnRemove}
        updateTier={MockOnUpdate}>
        <button>test</button>
      </TierCard>
    );

    act(() => {
      fireEvent.click(getByText(container, 'test'));
    });

    expect(await findAllByText(container, 'CardListItem')).toBeInTheDocument();
  });

  it('Component should have card', async () => {
    const { container } = render(
      <TierCard
        currentTier=""
        removeTier={MockOnRemove}
        updateTier={MockOnUpdate}
      />
    );

    expect(await findByTestId(container, 'cards')).toBeInTheDocument();
  });

  it('Card should have Clear button if item selected', async () => {
    const { container } = render(
      <TierCard
        currentTier="Tier.Tier1"
        removeTier={MockOnRemove}
        updateTier={MockOnUpdate}
      />
    );

    expect(await findByTestId(container, 'remove-tier')).toBeInTheDocument();
  });
});
