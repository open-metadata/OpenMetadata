/*
 *  Copyright 2023 Collate.
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
import { render, screen } from '@testing-library/react';
import TabsLabel from './TabsLabel.component';
import { TabsLabelProps } from './TabsLabel.interface';

const mockProps: TabsLabelProps = {
  name: 'Test tab',
  id: 'test-id',
};

describe('TabsLabel component', () => {
  it('Component should render', async () => {
    render(<TabsLabel {...mockProps} />);

    expect(await screen.findByText(mockProps.name)).toBeInTheDocument();
    expect(screen.queryByTestId('count')).not.toBeInTheDocument();
  });

  it('Count should be visible if provided', async () => {
    render(<TabsLabel {...mockProps} count={3} />);
    const count = await screen.findByTestId('count');

    expect(count).toBeVisible();
    expect(count.textContent).toStrictEqual('3');
  });

  it('Container should have id, provided via prop', async () => {
    render(<TabsLabel {...mockProps} count={3} />);
    const container = await screen.findByTestId(mockProps.id);

    expect(container).toBeVisible();
  });

  it('Description should visible, if provided via prop', async () => {
    render(<TabsLabel {...mockProps} description="test-description" />);
    const container = await screen.findByTestId('label-description');

    expect(container).toBeVisible();
  });
});
