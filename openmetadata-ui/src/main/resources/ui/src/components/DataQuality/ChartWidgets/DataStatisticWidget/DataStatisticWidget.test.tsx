/*
 *  Copyright 2024 Collate.
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
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataStatisticWidgetProps } from '../../DataQuality.interface';
import DataStatisticWidget from './DataStatisticWidget.component';

const mockProps: DataStatisticWidgetProps = {
  name: 'test-widget',
  title: 'Test Title',
  icon: () => <svg data-testid="test-icon" />,
  dataLabel: 'items',
  countValue: 10,
  redirectPath: '/test-path',
  linkLabel: 'View Details',
  isLoading: false,
};

describe('DataStatisticWidget component', () => {
  it('should render the widget with provided props', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('test-widget-data-statistic-widget')
    ).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('10 items')).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should show loading state when isLoading is true', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} isLoading />
      </MemoryRouter>
    );

    expect(screen.getByTestId('test-widget-data-statistic-widget')).toHaveClass(
      'ant-card-loading'
    );
  });
});
