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
import {
  LimitConfig,
  ResourceLimit,
  useLimitStore,
} from '../../../../context/LimitsProvider/useLimitsStore';
import { ManageButtonItemLabel } from '../../ManageButtonContentItem/ManageButtonContentItem.component';
import { ManageMenu, toManageMenuItems } from './ManageMenu';

const testCaseLimit = (
  limitReached: boolean
): ResourceLimit['featureLimitStatuses'][number] => ({
  name: 'testCase',
  limitReached,
  currentCount: 10,
  configuredLimit: {
    name: 'testCase',
    limits: { softLimit: 8, hardLimit: 10 },
  },
});

describe('ManageMenu', () => {
  afterEach(() => {
    useLimitStore.setState({ config: null, resourceLimit: {} });
  });

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

  it('should disable and not run an item whose resource limit is reached', async () => {
    const onImport = jest.fn();
    useLimitStore.setState({
      config: { enable: true } as LimitConfig,
      resourceLimit: { testCase: testCaseLimit(true) },
    });

    render(
      <ManageMenu
        items={[
          {
            key: 'import-button',
            label: 'Import',
            limitResource: 'testCase',
            onClick: onImport,
          },
        ]}
        label="Manage test cases"
      />
    );

    fireEvent.click(screen.getByTestId('manage-button'));

    const importItem = await screen.findByRole('menuitem', { name: 'Import' });

    expect(importItem).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(importItem);

    expect(onImport).not.toHaveBeenCalled();
  });

  it('should keep an item enabled while its resource is under the limit', async () => {
    const onImport = jest.fn();
    useLimitStore.setState({
      config: { enable: true } as LimitConfig,
      resourceLimit: { testCase: testCaseLimit(false) },
    });

    render(
      <ManageMenu
        items={[
          {
            key: 'import-button',
            label: 'Import',
            limitResource: 'testCase',
            onClick: onImport,
          },
        ]}
        label="Manage test cases"
      />
    );

    fireEvent.click(screen.getByTestId('manage-button'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Import' }));

    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('should jump to an item by typing its visible name', async () => {
    render(
      <ManageMenu
        items={[
          {
            key: 'item-1',
            label: (
              <ManageButtonItemLabel
                description="Rename the entity"
                icon={() => null}
                id="rename-button"
                name="Rename"
              />
            ),
          },
          {
            key: 'item-2',
            label: (
              <ManageButtonItemLabel
                description="Delete the entity"
                icon={() => null}
                id="delete-button"
                name="Delete"
              />
            ),
          },
        ]}
        label="Manage table"
      />
    );

    fireEvent.click(screen.getByTestId('manage-button'));
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'd' });

    expect(
      screen.getByTestId('delete-button').closest('[role="menuitem"]')
    ).toHaveAttribute('data-focused', 'true');
  });
});
