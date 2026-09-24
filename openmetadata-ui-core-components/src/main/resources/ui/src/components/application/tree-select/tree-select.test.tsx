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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TreeSelect } from './tree-select';

globalThis.ResizeObserver =
  globalThis.ResizeObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

const nodes = [
  { id: 'g1', label: 'Glossary One', value: 'g1', isLeaf: true },
  { id: 'g2', label: 'Glossary Two', value: 'g2', isLeaf: true },
];

const fetchData = async () => ({ nodes });

describe('TreeSelect', () => {
  it('marks single-select rows with a radio, not a checkbox', async () => {
    render(<TreeSelect searchable fetchData={fetchData} multiple={false} />);

    await userEvent.click(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getByTestId('radio-g1')).toBeTruthy());
    expect(screen.queryByTestId('checkbox-g1')).toBeNull();
  });

  // Picking hands focus back to the trigger, and reopening there would show the
  // search text in place of the value the user just chose.
  it('stays closed after a single-select pick', async () => {
    render(<TreeSelect searchable fetchData={fetchData} multiple={false} />);

    await userEvent.click(screen.getByRole('textbox'));
    await waitFor(() =>
      expect(screen.getByTestId('tree-node-g1')).toBeTruthy()
    );

    await userEvent.click(screen.getByTestId('tree-node-g1'));

    await waitFor(() =>
      expect(screen.queryByTestId('tree-node-g1')).toBeNull()
    );

    const trigger = screen.getByRole('textbox');

    expect(trigger).toHaveValue('Glossary One');

    // The browser hands focus back to the trigger after the pick; that must not
    // reopen the dropdown, or the search text hides the value just chosen.
    act(() => trigger.focus());

    expect(screen.queryByTestId('tree-node-g1')).toBeNull();
    expect(trigger).toHaveValue('Glossary One');
  });
});
