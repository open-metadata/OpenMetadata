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
import { lazy } from 'react';
import { EntityTabs } from '../../../enums/entity.enum';
import { LazyTabContent } from './LazyTabContent';

describe('LazyTabContent', () => {
  const LazyChild = lazy(() =>
    Promise.resolve({
      default: () => <div>Loaded active tab</div>,
    })
  );

  it('does not render fallback or child for inactive tabs', () => {
    render(
      <LazyTabContent activeTab={EntityTabs.SCHEMA} tab={EntityTabs.LINEAGE}>
        <LazyChild />
      </LazyTabContent>
    );

    expect(screen.queryByTestId('active-tab-loader')).not.toBeInTheDocument();
    expect(screen.queryByText('Loaded active tab')).not.toBeInTheDocument();
  });

  it('renders fallback while the active tab chunk is loading', async () => {
    render(
      <LazyTabContent activeTab={EntityTabs.LINEAGE} tab={EntityTabs.LINEAGE}>
        <LazyChild />
      </LazyTabContent>
    );

    expect(screen.getByTestId('active-tab-loader')).toBeInTheDocument();
    expect(await screen.findByText('Loaded active tab')).toBeInTheDocument();
  });
});
