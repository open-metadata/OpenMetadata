/*
 *  Copyright 2026 Collate.
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
import { getPieChartLabel } from './DataQualityUtils';

describe('getPieChartLabel', () => {
  it('renders the label and value as HTML for the chart centre overlay', () => {
    const { container } = render(getPieChartLabel('Tests', 10));

    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    // SVG <text> only rendered inside the old recharts <svg>.
    expect(container.querySelector('text')).toBeNull();
  });

  it('defaults the value to 0', () => {
    render(getPieChartLabel('Tables'));

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
