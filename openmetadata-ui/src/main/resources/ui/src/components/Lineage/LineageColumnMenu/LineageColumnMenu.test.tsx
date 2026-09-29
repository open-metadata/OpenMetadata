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
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import LineageColumnMenu from './LineageColumnMenu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LineageColumnMenu', () => {
  const props = { onEdit: jest.fn() };

  it('edits upstream and downstream', async () => {
    render(<LineageColumnMenu {...props} />);
    fireEvent.click(screen.getByTestId('lineage-column-menu'));
    fireEvent.click(await screen.findByText('label.edit-upstream'));

    expect(props.onEdit).toHaveBeenCalledWith(
      LineageDirection.Upstream,
      expect.anything()
    );

    fireEvent.click(screen.getByTestId('lineage-column-menu'));
    fireEvent.click(await screen.findByText('label.edit-downstream'));

    expect(props.onEdit).toHaveBeenCalledWith(
      LineageDirection.Downstream,
      expect.anything()
    );
  });

  it('anchors the popover trigger ref to a real, mounted element', async () => {
    const onEdit = jest.fn();
    render(<LineageColumnMenu {...props} onEdit={onEdit} />);
    fireEvent.click(screen.getByTestId('lineage-column-menu'));
    fireEvent.click(await screen.findByText('label.edit-upstream'));

    const triggerRef = onEdit.mock.calls[0][1];

    expect(triggerRef.current).toBeInstanceOf(HTMLElement);
    expect(
      triggerRef.current.contains(screen.getByTestId('lineage-column-menu'))
    ).toBe(true);
  });

  it('does not render a delete item', async () => {
    render(<LineageColumnMenu {...props} />);
    fireEvent.click(screen.getByTestId('lineage-column-menu'));

    await screen.findByText('label.edit-upstream');

    expect(screen.queryByText('label.delete')).not.toBeInTheDocument();
  });

  it('does not propagate the trigger click to the column row', () => {
    const onParentClick = jest.fn();
    render(
      // stand-in for the column row's onClick handler that selects the column
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={onParentClick}>
        <LineageColumnMenu {...props} />
      </div>
    );
    fireEvent.click(screen.getByTestId('lineage-column-menu'));

    expect(onParentClick).not.toHaveBeenCalled();
  });
});
