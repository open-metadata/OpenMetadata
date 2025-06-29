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
import { PRIMARY_COLOR } from '../../../../constants/Color.constants';
import StatusDataWidget from './StatusCardWidget.component';
import { StatusCardWidgetProps } from './StatusCardWidget.interface';

const mockStatusData = {
  title: 'Test Title',
  total: 100,
  success: 80,
  aborted: 10,
  failed: 10,
};

const MockIcon = ({
  color,
  height,
  width,
}: {
  color: string;
  height: number;
  width: number;
}) => (
  <svg
    data-testid="mock-icon"
    fill={color}
    height={height}
    viewBox="0 0 14 12"
    width={width}
  />
);
const defaultProps: StatusCardWidgetProps = {
  statusData: mockStatusData,
  icon: MockIcon as SvgComponent,
};

describe('StatusDataWidget', () => {
  beforeEach(() => {
    render(<StatusDataWidget {...defaultProps} />);
  });

  it('should render the component with provided data', () => {
    expect(screen.getByTestId('status-data-widget')).toBeInTheDocument();
    expect(screen.getByTestId('status-title')).toHaveTextContent(
      mockStatusData.title
    );
    expect(screen.getByTestId('total-value')).toHaveTextContent(
      mockStatusData.total.toString()
    );
    expect(screen.getByTestId('success-count')).toHaveTextContent(
      mockStatusData.success.toString()
    );
    expect(screen.getByTestId('aborted-count')).toHaveTextContent(
      mockStatusData.aborted.toString()
    );
    expect(screen.getByTestId('failed-count')).toHaveTextContent(
      mockStatusData.failed.toString()
    );
  });

  it('should render the icon with correct props', () => {
    const icon = screen.getByTestId('mock-icon');

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('fill', PRIMARY_COLOR);
    expect(icon).toHaveAttribute('height', '20');
    expect(icon).toHaveAttribute('width', '20');
  });
});
