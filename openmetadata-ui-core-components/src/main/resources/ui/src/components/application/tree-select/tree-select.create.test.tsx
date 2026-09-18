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
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TreeSelect } from './tree-select';
import type {
  TreeSelectDataResponse,
  TreeSelectProps,
} from './tree-select.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const fetchData = async (): Promise<TreeSelectDataResponse> => ({
  nodes: [
    { id: 'a', label: 'Alpha', value: 'a', isLeaf: true },
    { id: 'b', label: 'Beta', value: 'b', isLeaf: true },
  ],
});

const renderTree = (props: Partial<TreeSelectProps> = {}) =>
  render(
    <TreeSelect
      isOpen
      multiple
      searchable
      createLabel="Add new domain"
      data-testid="domain-tree"
      debounceMs={0}
      fetchData={fetchData}
      triggerVariant="button"
      value={[]}
      onCreate={vi.fn()}
      {...props}
    />
  );

describe('TreeSelect create row', () => {
  afterEach(() => cleanup());

  it('should render the create row when both onCreate and createLabel are provided', () => {
    renderTree();

    const createButton = screen.getByTestId('domain-tree-create');

    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveTextContent('Add new domain');
  });

  it('should not render the create row when onCreate is omitted', () => {
    renderTree({ onCreate: undefined });

    expect(screen.queryByTestId('domain-tree-create')).not.toBeInTheDocument();
  });

  it('should not render the create row when createLabel is omitted', () => {
    renderTree({ createLabel: undefined });

    expect(screen.queryByTestId('domain-tree-create')).not.toBeInTheDocument();
  });

  it('should call onCreate with the current search term and close the dropdown', () => {
    const onCreate = vi.fn();
    const onOpenChange = vi.fn();
    renderTree({ onCreate, onOpenChange });

    fireEvent.click(screen.getByTestId('domain-tree-create'));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should hand the typed search term to onCreate', async () => {
    const onCreate = vi.fn();
    renderTree({ onCreate });

    fireEvent.change(screen.getByTestId('domain-tree-search'), {
      target: { value: 'Finance' },
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('domain-tree-create'));

      expect(onCreate).toHaveBeenCalledWith('Finance');
    });
  });
});
