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
import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TreeSelect } from './tree-select';

// jsdom ships no ResizeObserver; the open dropdown measures its trigger with one.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

const fetchNodes = () =>
  vi.fn().mockResolvedValue({
    nodes: [{ id: 'a', label: 'Node A', value: 'a', isLeaf: true }],
  });

const renderCustomTrigger = (
  fetchData: ReturnType<typeof fetchNodes>,
  isOpen: boolean
) =>
  render(
    <TreeSelect
      fetchData={fetchData}
      isOpen={isOpen}
      renderTrigger={() => <span>trigger</span>}
    />
  );

describe('TreeSelect', () => {
  it('does not fetch while a custom-trigger picker stays closed', () => {
    const fetchData = fetchNodes();

    renderCustomTrigger(fetchData, false);

    expect(screen.getByText('trigger')).toBeInTheDocument();
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('fetches the root when the picker first opens', async () => {
    const fetchData = fetchNodes();
    const { rerender } = renderCustomTrigger(fetchData, false);

    rerender(
      <TreeSelect
        isOpen
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    expect(await screen.findByText('Node A')).toBeInTheDocument();
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded tree across a close and reopen', async () => {
    const fetchData = fetchNodes();
    const { rerender } = renderCustomTrigger(fetchData, true);

    await screen.findByText('Node A');

    rerender(
      <TreeSelect
        fetchData={fetchData}
        isOpen={false}
        renderTrigger={() => <span>trigger</span>}
      />
    );
    rerender(
      <TreeSelect
        isOpen
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    expect(await screen.findByText('Node A')).toBeInTheDocument();
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('fetches on mount for the button variant, whose badge needs the roots', async () => {
    const fetchData = fetchNodes();

    render(
      <TreeSelect
        fetchData={fetchData}
        label="Glossary"
        triggerVariant="button"
      />
    );

    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
  });
});
