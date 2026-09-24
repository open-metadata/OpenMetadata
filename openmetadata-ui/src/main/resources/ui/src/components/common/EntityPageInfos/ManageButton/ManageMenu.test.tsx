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
import { ManageMenu, toManageMenuItems } from './ManageMenu';

describe('ManageMenu', () => {
  it('should open on the trigger and run the chosen item with an antd-compatible event', async () => {
    const onRename = jest.fn((info) => info.domEvent.stopPropagation());

    render(
      <ManageMenu
        items={[
          {
            key: 'rename-button',
            label: <span data-testid="rename-label">Rename</span>,
            onClick: onRename,
          },
          { key: 'delete-button', label: 'Delete', disabled: true },
        ]}
        label="Manage table"
      />
    );

    fireEvent.click(screen.getByTestId('manage-button'));

    expect(
      await screen.findByTestId('manage-dropdown-list-container')
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    fireEvent.click(screen.getByTestId('rename-label'));

    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'rename-button',
        keyPath: ['rename-button'],
      })
    );
  });

  it('should render a custom trigger in place of the icon button', () => {
    render(
      <ManageMenu
        items={[{ key: 'assets', label: 'Assets' }]}
        label="Add"
        trigger={<button data-testid="custom-trigger">Add</button>}
      />
    );

    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('should keep only item entries when adapting antd-shaped items', () => {
    const onClick = jest.fn();

    expect(
      toManageMenuItems([
        { key: 1, label: 'Import', onClick },
        { type: 'divider' },
        null,
      ])
    ).toEqual([{ key: '1', label: 'Import', disabled: undefined, onClick }]);
  });
});
