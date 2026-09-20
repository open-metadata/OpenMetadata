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

const glossary: TreeSelectNode = {
  id: 'Taxation',
  label: 'Taxation',
  value: 'Taxation',
  isLeaf: true,
};

const renderInsideStoppedRegion = () => {
  const fetchData = vi.fn().mockResolvedValue({ nodes: [glossary] });

  render(
    <div>
      {/* A drawer that swallows pointer events before they reach the document,
          the way an overlay with its own dismissal does. */}
      <div
        data-testid="drawer"
        onPointerDownCapture={(event) => event.stopPropagation()}>
        <button data-testid="drawer-close" type="button">
          close
        </button>
      </div>
      <TreeSelect
        multiple
        data-testid="picker"
        fetchData={fetchData}
        triggerVariant="button"
      />
    </div>
  );
};

describe('TreeSelect dismissal', () => {
  it('should stay open when the trigger itself is clicked open', async () => {
    renderInsideStoppedRegion();

    fireEvent.click(screen.getByTestId('picker'));

    await waitFor(() =>
      expect(screen.getByTestId('picker-popover')).toBeInTheDocument()
    );
  });

  it('should close when a pointer-down outside never reaches the document', async () => {
    renderInsideStoppedRegion();

    fireEvent.click(screen.getByTestId('picker'));

    await waitFor(() =>
      expect(screen.getByTestId('picker-popover')).toBeInTheDocument()
    );

    fireEvent.pointerDown(screen.getByTestId('drawer-close'));

    await waitFor(() =>
      expect(screen.queryByTestId('picker-popover')).toBeNull()
    );
  });

  // The trigger opens on focus, and a dismiss restores focus to it.
  it('should stay closed when dismissal returns focus to the trigger input', async () => {
    const fetchData = vi.fn().mockResolvedValue({ nodes: [glossary] });

    render(
      <div>
        <button data-testid="outside" type="button">
          outside
        </button>
        <TreeSelect
          multiple
          searchable
          data-testid="field"
          fetchData={fetchData}
        />
      </div>
    );

    const input = screen.getByTestId('field').querySelector('input');
    fireEvent.focus(input as HTMLInputElement);

    await waitFor(() =>
      expect(screen.getByTestId('field-popover')).toBeInTheDocument()
    );

    fireEvent.pointerDown(screen.getByTestId('outside'));
    // What react-aria does on close: focus goes back to the trigger.
    fireEvent.focus(input as HTMLInputElement);

    await waitFor(() =>
      expect(screen.queryByTestId('field-popover')).toBeNull()
    );
  });
});
