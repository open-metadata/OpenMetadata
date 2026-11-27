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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryExtractionAction } from '../../../../constants/ContextCenter.constants';
import { MemoryExtraction } from '../../../../hooks/discovery/context-center/useMemoryExtraction';
import MemoryExtractionMenuItem from './MemoryExtractionMenuItem';

const requestExtraction = jest.fn();

// The real menu: react-aria wires the item's name, description and action.
const openMenu = async (extraction: Partial<MemoryExtraction>) => {
  render(
    <Dropdown.Root>
      <Button>open</Button>
      <Dropdown.Popover>
        <Dropdown.Menu>
          <MemoryExtractionMenuItem
            isRequesting={false}
            requestExtraction={requestExtraction}
            {...extraction}
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
  fireEvent.click(screen.getByRole('button', { name: 'open' }));

  return screen.findByRole('menu');
};

describe('MemoryExtractionMenuItem', () => {
  it('runs the extraction when pressed', async () => {
    await openMenu({ action: MemoryExtractionAction.Extract });
    const item = screen.getByTestId('memory-extraction-menu-btn');

    expect(item).toHaveAccessibleName('label.extract');

    fireEvent.click(item);

    expect(requestExtraction).toHaveBeenCalledTimes(1);
  });

  // React Aria's keyboard navigation skips a disabled item, so its reason is not hover-only.
  it('shows why it is disabled, as the description assistive technology reads', async () => {
    await openMenu({
      action: MemoryExtractionAction.Retry,
      disabledReasonKey: 'message.memory-extraction-off',
    });
    const item = screen.getByTestId('memory-extraction-menu-btn');

    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleName('label.retry');
    expect(item).toHaveAccessibleDescription('message.memory-extraction-off');

    fireEvent.click(item);

    expect(requestExtraction).not.toHaveBeenCalled();
  });

  it('cannot be pressed again while its request runs', async () => {
    await openMenu({
      action: MemoryExtractionAction.Extract,
      isRequesting: true,
    });
    const item = screen.getByTestId('memory-extraction-menu-btn');

    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).not.toHaveAccessibleDescription();
  });

  it('offers nothing when the document has no action', async () => {
    expect(await openMenu({ action: undefined })).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-extraction-menu-btn')
    ).not.toBeInTheDocument();
  });
});
