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

import { fireEvent, render, screen } from '@testing-library/react';
import OntologyTermSelection from './OntologyTermSelection';

const NODES = [
  { id: 'alpha', label: 'Alpha concept', type: 'glossaryTerm' },
  { id: 'beta', label: 'Beta concept', type: 'glossaryTerm' },
  { id: 'asset', label: 'Asset', type: 'table' },
];

describe('OntologyTermSelection', () => {
  it('searches term nodes and emits a bounded typed selection', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <OntologyTermSelection
        label="Concepts"
        maxItems={1}
        nodes={NODES}
        selectedIds={[]}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'label.search' }), {
      target: { value: 'alpha' },
    });

    expect(screen.getByText('Alpha concept')).toBeInTheDocument();
    expect(screen.queryByText('Beta concept')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Alpha concept'));

    expect(onChange).toHaveBeenCalledWith(['alpha']);

    rerender(
      <OntologyTermSelection
        label="Concepts"
        maxItems={1}
        nodes={NODES}
        selectedIds={['alpha']}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.search' }), {
      target: { value: '' },
    });

    expect(screen.getByText('Beta concept').closest('label')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });
});
