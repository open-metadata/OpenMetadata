/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { statData } from '../MyData/MyData.mock';
import Stats from './Stats';

describe('Test Stats Component', () => {
  const { testdata1, testdata2 } = statData;

  it('Renders the proper HTML when badge is TABLE', async () => {
    const { badgeName, generalStats, tableStats } = testdata1;
    const { container } = render(
      <Stats
        badgeName={badgeName}
        generalStats={generalStats}
        tableStats={tableStats}
      />,
      { wrapper: MemoryRouter }
    );
    const linkElement = await findByTestId(container, 'stats-link');

    expect(linkElement.textContent).toBe('View all 18 instances');
  });

  it('Renders the proper HTML when badge is not TABLE', async () => {
    const { badgeName, generalStats, tableStats } = testdata2;
    const { container } = render(
      <Stats
        badgeName={badgeName}
        generalStats={generalStats}
        tableStats={tableStats}
      />,
      { wrapper: MemoryRouter }
    );
    const linkElement = await findByTestId(container, 'stats-link');

    expect(linkElement.textContent).toBe('View recent runs');

    const runsCount = await findByTestId(container, 'runs-count');

    expect(runsCount.textContent).toBe('5432');

    const usersCount = await findByTestId(container, 'users-count');

    expect(usersCount.textContent).toBe('24 users');
  });
});
