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
import { getTextDiff } from '../../../utils/EntityDiffUtils';
import { EntityPageTitle } from './EntityPageTitle';

describe('EntityPageTitle', () => {
  it('renders version-view diff markup as highlighted spans, not literal HTML', () => {
    render(
      <EntityPageTitle
        displayName={getTextDiff('Old Title', 'New Title')}
        name={getTextDiff('old_name', 'new_name')}
      />
    );

    const displayName = screen.getByTestId('entity-header-display-name');
    const name = screen.getByTestId('entity-header-name');

    expect(displayName).not.toHaveTextContent('<span');
    expect(name).not.toHaveTextContent('<span');
    expect(screen.getAllByTestId('diff-added').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('diff-removed').length).toBeGreaterThan(0);
  });

  it('renders a plain name as the title when there is no display name', () => {
    render(<EntityPageTitle name="customer_orders" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'customer_orders'
    );
    expect(
      screen.queryByTestId('entity-header-display-name')
    ).not.toBeInTheDocument();
  });
});
