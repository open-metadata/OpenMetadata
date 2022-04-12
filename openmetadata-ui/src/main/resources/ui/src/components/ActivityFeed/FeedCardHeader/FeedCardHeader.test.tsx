/*
 *  Copyright 2021 Collate
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
  findByTestId,
  findByText,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedCardHeader from './FeedCardHeader';

jest.mock('../../../axiosAPIs/userAPI', () => ({
  getUserByName: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getPartialNameFromFQN: jest.fn().mockReturnValue('feedcard'),
  getNonDeletedTeams: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getEntityLink: jest.fn(),
}));

jest.mock('../../../utils/TimeUtils', () => ({
  getDayTimeByTimeStamp: jest.fn(),
}));

jest.mock('../../common/avatar/Avatar', () => {
  return jest.fn().mockReturnValue(<p>Avatar</p>);
});

const mockFeedHeaderProps = {
  createdBy: 'xyz',
  entityFQN: 'x.y.z',
  entityField: 'z',
  entityType: 'y',
  isEntityFeed: true,
  timeStamp: 1647322547179,
};

describe('Test Feedheader Component', () => {
  it('Checks if the Feedheader component has isEntityFeed as true', async () => {
    const { container } = render(<FeedCardHeader {...mockFeedHeaderProps} />, {
      wrapper: MemoryRouter,
    });
    const createdBy = await findByText(container, /xyz/i);

    const headerElement = await findByTestId(container, 'headerText');
    const entityFieldElement = await findByTestId(
      container,
      'headerText-entityField'
    );
    const entityTypeElement = queryByTestId(container, 'entityType');
    const entityLinkElement = queryByTestId(container, 'entitylink');
    const timeStampElement = await findByTestId(container, 'timestamp');

    expect(createdBy).toBeInTheDocument();

    expect(headerElement).toBeInTheDocument();
    expect(entityFieldElement).toBeInTheDocument();
    expect(entityTypeElement).not.toBeInTheDocument();
    expect(entityLinkElement).not.toBeInTheDocument();
    expect(timeStampElement).toBeInTheDocument();
  });

  it('Checks if the Feedheader component has isEntityFeed as false', async () => {
    const { container } = render(
      <FeedCardHeader {...mockFeedHeaderProps} isEntityFeed={false} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const createdBy = await findByText(container, /xyz/i);

    const headerElement = await findByTestId(container, 'headerText');
    const entityFieldElement = queryByTestId(
      container,
      'headerText-entityField'
    );
    const entityTypeElement = await findByTestId(container, 'entityType');
    const entityLinkElement = await findByTestId(container, 'entitylink');
    const timeStampElement = await findByTestId(container, 'timestamp');

    expect(createdBy).toBeInTheDocument();

    expect(headerElement).toBeInTheDocument();
    expect(entityFieldElement).not.toBeInTheDocument();
    expect(entityTypeElement).toBeInTheDocument();
    expect(entityLinkElement).toBeInTheDocument();
    expect(timeStampElement).toBeInTheDocument();
  });
});
