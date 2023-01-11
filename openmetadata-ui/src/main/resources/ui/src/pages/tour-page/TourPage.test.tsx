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

import { findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CurrentTourPageType } from '../../enums/tour.enum';
import TourPageComponent from './TourPage.component';

jest.mock('components/nav-bar/NavBar', () => {
  return jest.fn().mockReturnValue(<div>NavBarComponent</div>);
});

jest.mock('components/tour/Tour', () => {
  return jest.fn().mockReturnValue(<div>TourComponent</div>);
});

jest.mock('components/MyData/MyData.component', () => {
  return jest.fn().mockReturnValue(<div>MyDataComponent</div>);
});

jest.mock('components/MyData/MyData.component', () => {
  return jest.fn().mockReturnValue(<div>MyDataComponent</div>);
});

jest.mock('components/Explore/Explore.component', () => {
  return jest.fn().mockReturnValue(<div>ExploreComponent</div>);
});

jest.mock('components/DatasetDetails/DatasetDetails.component', () => {
  return jest.fn().mockReturnValue(<div>DatasetDetailsComponent</div>);
});

jest.mock('../../AppState', () => {
  return jest.fn().mockReturnValue({
    isTourOpen: false,
    currentTourPage: CurrentTourPageType.MY_DATA_PAGE,
    activeTabforTourDatasetPage: 1,
  });
});

describe('Test TourPage component', () => {
  it('TourPage component should render properly', async () => {
    const { container } = render(<TourPageComponent />, {
      wrapper: MemoryRouter,
    });

    const navBar = await findByText(container, /NavBarComponent/i);
    const TourComponent = await findByText(container, /NavBarComponent/i);

    expect(navBar).toBeInTheDocument();
    expect(TourComponent).toBeInTheDocument();
  });
});
