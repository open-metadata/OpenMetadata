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
import ContextSimplePillarCard from './ContextSimplePillarCard.component';

describe('ContextSimplePillarCard', () => {
  it('renders the title and children', () => {
    render(
      <ContextSimplePillarCard title="Recently Viewed">
        <div>List content</div>
      </ContextSimplePillarCard>
    );

    expect(screen.getByText('Recently Viewed')).toBeInTheDocument();
    expect(screen.getByText('List content')).toBeInTheDocument();
  });

  it('renders skeleton loaders when isLoading is true', () => {
    render(
      <ContextSimplePillarCard isLoading title="Recently Viewed">
        <div>List content</div>
      </ContextSimplePillarCard>
    );

    expect(screen.queryByText('List content')).not.toBeInTheDocument();
  });

  it('renders the empty message when isEmpty is true', () => {
    render(
      <ContextSimplePillarCard
        isEmpty
        emptyMessage="No data available"
        title="Recently Viewed">
        <div>List content</div>
      </ContextSimplePillarCard>
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText('List content')).not.toBeInTheDocument();
  });
});
