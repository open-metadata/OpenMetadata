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

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import BreadcrumbsComponent from './Breadcrumbs';

describe('Test Breadcrumbs Component', () => {
  it('Breadcrumb path should render "My Data"', async () => {
    const { findByText } = render(
      <MemoryRouter initialEntries={[ROUTES.MY_DATA]}>
        <BreadcrumbsComponent />
      </MemoryRouter>
    );
    const myData = await findByText(/My Data/);

    expect(myData).toBeInTheDocument();
  });
});
