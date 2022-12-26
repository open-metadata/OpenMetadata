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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import SwitchField from './SwitchField.component';

const mockProps = {
  dbtUpdateDescriptions: false,
  id: 'test-id',
  handleUpdateDescriptions: jest.fn(),
};

jest.mock('antd', () => ({
  Space: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Switch: jest
    .fn()
    .mockImplementation(() => <div data-testid="switch">Switch</div>),
}));

describe('SwitchField', () => {
  it('Component should render properly', () => {
    const { container } = render(<SwitchField {...mockProps} />);

    const switchLabel = getByTestId(container, 'test-id');
    const switchButton = getByTestId(container, 'switch');
    const switchDescription = getByTestId(container, 'switch-description');

    expect(switchLabel).toBeInTheDocument();
    expect(switchButton).toBeInTheDocument();
    expect(switchDescription).toBeInTheDocument();
  });
});
