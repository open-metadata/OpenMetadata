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
import { render } from '@testing-library/react';
import AppBadge from './Badge.component';

describe('<Badge /> component', () => {
  it('should render badge with label is label is passed', () => {
    const { getByText } = render(<AppBadge label="test" />);

    expect(getByText('test')).toBeInTheDocument();
  });

  it('should render badge without icon if icon is not passed', () => {
    const { queryByTestId } = render(<AppBadge label="test" />);

    expect(queryByTestId('badge-icon')).not.toBeInTheDocument();
  });

  it('should render badge with icon if icon is passed', () => {
    const { queryByTestId, getByText } = render(
      <AppBadge icon="test-icon" label="test" />
    );

    expect(queryByTestId('badge-icon')).toBeInTheDocument();
    expect(getByText('test-icon')).toBeInTheDocument();
  });

  it('should apply className to container if provided', () => {
    const { queryByTestId } = render(
      <AppBadge className="test-className" icon="test-icon" label="test" />
    );

    expect(queryByTestId('badge-container')).toHaveClass('test-className');
  });

  it('should apply color property to container element if provided', () => {
    const { queryByTestId } = render(<AppBadge color="#000" label="test" />);

    expect(queryByTestId('badge-container')).toHaveStyle({ color: '#000' });
  });

  it('should apply bgColor property to container element if provided', () => {
    const { queryByTestId } = render(<AppBadge bgColor="#000" label="test" />);

    expect(queryByTestId('badge-container')).toHaveStyle({
      'background-color': '#000',
    });
  });
});
