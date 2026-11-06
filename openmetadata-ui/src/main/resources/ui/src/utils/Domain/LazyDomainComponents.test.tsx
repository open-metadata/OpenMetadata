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
import { LazyDataQualityDashboard } from './LazyDomainComponents';

jest.mock(
  '../../components/DataQuality/DataQualityDashboard/DataQualityDashboard.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="data-quality-dashboard" />,
  })
);

describe('LazyDomainComponents', () => {
  it('shows loader while loading data quality dashboard', async () => {
    render(<LazyDataQualityDashboard />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      await screen.findByTestId('data-quality-dashboard')
    ).toBeInTheDocument();
  });
});
