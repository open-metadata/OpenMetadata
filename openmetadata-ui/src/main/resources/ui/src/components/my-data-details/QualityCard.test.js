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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import QualityCard from './QualityCard';

describe('Test QualityCard Component', () => {
  it('Render the proper details passed to the component', () => {
    const lastRunsData = ['Success', 'Failed', 'Unknown', 'Success', 'Success'];
    const { container } = render(
      <QualityCard
        heading="Freshness"
        lastRunResults="June 21, 2020 05:00 AM"
        lastRunsData={lastRunsData}
      />
    );
    const statusIcon = getByTestId(container, 'run-status-icon');

    expect(statusIcon).toBeInTheDocument();

    const heading = getByTestId(container, 'quality-card-heading');

    expect(heading.textContent).toBe('Freshness');

    const lastRunsStatusContainer = getByTestId(
      container,
      'last-run-status-container'
    );

    expect(lastRunsStatusContainer).toBeInTheDocument();

    const lastRunResults = getByTestId(container, 'last-run-results');

    expect(lastRunResults.textContent).toBe('June 21, 2020 05:00 AM');
  });
});
