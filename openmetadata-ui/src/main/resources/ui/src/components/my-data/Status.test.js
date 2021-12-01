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
import Status from './Status';

describe('Test Status Component', () => {
  it('Renders "Ready to Use" as the status', async () => {
    const { findByText } = render(<Status text="Ready to Use" />);
    const statusText = await findByText('Ready to Use');

    expect(statusText).toBeInTheDocument();
  });

  it('Check for the status icon rendered', () => {
    const { container } = render(<Status text="Ready to Use" />);
    const dotDiv = getByTestId(container, 'status-icon');

    expect(dotDiv).toBeInTheDocument();
  });

  it('Check for the proper class added to status icon and status text', () => {
    const { container } = render(<Status text="Ready to Use" />);
    const dotDiv = getByTestId(container, 'status-icon');
    const statusText = getByTestId(container, 'status-text');

    expect(statusText).toHaveClass('text-success');
    expect(dotDiv).toHaveClass('text-success');
  });
});
