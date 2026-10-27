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
import { ConfirmPopover } from '@openmetadata/ui-core-components';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAnchoredConfirm } from './useAnchoredConfirm';

interface Row {
  id: string;
  name: string;
}

const ROWS: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

const Table = ({ onDelete }: { onDelete: (row: Row) => void }) => (
  <ul>
    {ROWS.map((row) => (
      <li key={row.id}>
        <button type="button" onClick={() => onDelete(row)}>
          {`Delete ${row.name}`}
        </button>
      </li>
    ))}
  </ul>
);

const Host = ({ onConfirm }: { onConfirm: (row: Row) => Promise<boolean> }) => {
  const { containerRef, target, open, popoverProps } =
    useAnchoredConfirm<Row>();

  return (
    <div ref={containerRef}>
      <Table onDelete={open} />
      {target && (
        <ConfirmPopover
          {...popoverProps}
          title={`Delete ${target.name}?`}
          onConfirm={() => onConfirm(target)}
        />
      )}
    </div>
  );
};

describe('useAnchoredConfirm', () => {
  it('opens for the row whose button was pressed and runs confirm with it', async () => {
    const onConfirm = jest.fn().mockResolvedValue(true);
    render(<Host onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Beta' }));

    expect(screen.getByText('Delete Beta?')).toBeInTheDocument();

    await act(async () =>
      fireEvent.click(screen.getByTestId('confirm-popover-confirm'))
    );

    expect(onConfirm).toHaveBeenCalledWith(ROWS[1]);
    expect(screen.queryByText('Delete Beta?')).toBeNull();
  });

  it('keeps the target when confirm fails and clears it on cancel', async () => {
    const onConfirm = jest.fn().mockResolvedValue(false);
    render(<Host onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    await act(async () =>
      fireEvent.click(screen.getByTestId('confirm-popover-confirm'))
    );

    expect(screen.getByText('Delete Alpha?')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-popover-cancel'));

    expect(screen.queryByText('Delete Alpha?')).toBeNull();
  });
});
