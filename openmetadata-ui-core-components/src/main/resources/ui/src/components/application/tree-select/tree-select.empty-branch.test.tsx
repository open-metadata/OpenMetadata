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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TreeSelect } from './tree-select';
import type { TreeSelectNode } from './tree-select.types';

const emptyGlossary: TreeSelectNode = {
  id: 'Taxation',
  label: 'Taxation',
  value: 'Taxation',
  // Expandable: the term count is unknown until the children load.
  isLeaf: false,
  lazyLoad: true,
};

const renderTreeSelect = () => {
  const fetchData = vi
    .fn()
    .mockImplementation(async ({ parentId }: { parentId?: string }) => ({
      nodes: parentId ? [] : [emptyGlossary],
    }));

  render(
    <TreeSelect
      multiple
      searchable
      data-testid="picker"
      fetchData={fetchData}
      noDataMessage="No terms"
      triggerVariant="button"
    />
  );

  return fetchData;
};

describe('TreeSelect empty branch', () => {
  it('should let a glossary with no terms expand and collapse', async () => {
    renderTreeSelect();

    fireEvent.click(screen.getByTestId('picker'));

    await waitFor(() =>
      expect(screen.getByTestId('tree-node-Taxation')).toBeInTheDocument()
    );

    const chevron = screen
      .getByRole('row', { name: /Taxation/ })
      .querySelector('button');

    expect(chevron).not.toBeNull();

    // Expanding a branch that loads nothing still has to show a row, or the
    // chevron looks inert.
    fireEvent.click(chevron as HTMLButtonElement);

    await waitFor(() =>
      expect(
        screen.getByTestId('tree-node-empty-Taxation')
      ).toBeInTheDocument()
    );

    expect(screen.getByText('No terms')).toBeInTheDocument();

    fireEvent.click(chevron as HTMLButtonElement);

    await waitFor(() =>
      expect(screen.queryByTestId('tree-node-empty-Taxation')).toBeNull()
    );
  });
});
