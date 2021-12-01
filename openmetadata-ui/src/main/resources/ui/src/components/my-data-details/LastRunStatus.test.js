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

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import LastRunStatus from './LastRunStatus';

describe('Test LastRunStatus Component', () => {
  it('Render the proper number of short and long status boxes', () => {
    const lastRunsData = ['Success', 'Failed', 'Unknown', 'Success', 'Success'];
    const { container } = render(<LastRunStatus lastRunsData={lastRunsData} />);
    const shortStatusboxes = getAllByTestId(container, 'run-status-short');

    expect(shortStatusboxes.length).toBe(4);

    const longStatusboxes = getAllByTestId(container, 'run-status-long');

    expect(longStatusboxes.length).toBe(1);
  });

  it('Renders proper status to be reflected in short boxes', () => {
    const lastRunsData = ['Success', 'Failed', 'Unknown', 'Success', 'Success'];
    const { container } = render(<LastRunStatus lastRunsData={lastRunsData} />);
    const shortStatusboxes = getAllByTestId(container, 'run-status-short');
    const failedBoxes = shortStatusboxes.filter((box) => {
      return box.className.includes('danger') && box;
    });

    expect(failedBoxes.length).toBe(1);

    const unknownBoxes = shortStatusboxes.filter((box) => {
      return box.className.includes('grey') && box;
    });

    expect(unknownBoxes.length).toBe(1);

    const successBoxes = shortStatusboxes.filter((box) => {
      return box.className.includes('success') && box;
    });

    expect(successBoxes.length).toBe(2);
  });

  it('Renders proper status to be reflected in long boxes', () => {
    const lastRunsData = ['Success', 'Failed', 'Unknown', 'Success', 'Success'];
    const { container } = render(<LastRunStatus lastRunsData={lastRunsData} />);
    const longStatusbox = getByTestId(container, 'run-status-long');

    expect(longStatusbox.className.includes('success')).toBe(true);
  });
});
