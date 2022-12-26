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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { act } from 'react-test-renderer';
import EntitySummaryDetails from './EntitySummaryDetails';

const mockData = {
  key: 'test-owner',
  value: '/test-path/test-entity',
  placeholderText: 'test-entity',
  id: '397e4280-02df-4ef6-9bf5-c0f439517b55',
  isEntityDetails: true,
  isLink: true,
  openInNewTab: false,
};

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Row: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="entity-summary-details">{children}</div>
    )),
  Col: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Dropdown: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  Popover: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../generated/entity/data/table', () =>
  jest.fn().mockReturnValue(<>Table</>)
);
jest.mock('../../../generated/type/tagLabel', () =>
  jest.fn().mockReturnValue(<>TagLabel</>)
);
jest.mock('../../../utils/CommonUtils', () => ({
  getTeamsUser: jest.fn().mockReturnValue({
    ownerName: 'test-owner',
    id: 'test-id',
  }),
}));
jest.mock('../../buttons/Button/Button', () =>
  jest.fn().mockReturnValue(<>Button</>)
);

jest.mock('../ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<>ProfilePicture</>)
);
jest.mock('../TierCard/TierCard', () =>
  jest.fn().mockReturnValue(<>TierCard</>)
);
jest.mock('../OwnerWidget/OwnerWidgetWrapper.component', () =>
  jest.fn().mockReturnValue(<>OwnerWidgetWrapper</>)
);

describe('EntitySummaryDetails Component', () => {
  it('On Load Component should render', async () => {
    const { container } = render(<EntitySummaryDetails data={mockData} />);

    await act(async () => {
      const EntitySummary = await findByTestId(
        container,
        'entity-summary-details'
      );

      expect(EntitySummary).toBeInTheDocument();
    });
  });
});
