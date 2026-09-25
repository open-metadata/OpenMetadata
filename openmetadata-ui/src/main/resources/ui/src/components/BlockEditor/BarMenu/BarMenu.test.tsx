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
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import BarMenu from './BarMenu';

const run = jest.fn();
const toggleBold = jest.fn(() => ({ run }));
const chain = {
  focus: () => chain,
  toggleBold,
};

const editor = {
  chain: () => chain,
  isActive: jest.fn((name: string) => name === 'bold'),
} as unknown as Editor;

describe('BarMenu', () => {
  it('renders a labelled button per format with separators between groups', () => {
    render(<BarMenu editor={editor} />);

    expect(screen.getAllByRole('button')).toHaveLength(11);
    expect(screen.getAllByRole('separator')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'bold' })).toBeInTheDocument();
  });

  it('runs the command on mouse down without moving focus off the editor', () => {
    render(<BarMenu editor={editor} />);

    const bold = screen.getByRole('button', { name: 'bold' });
    const mouseDown = createEvent.mouseDown(bold, { button: 0 });
    fireEvent(bold, mouseDown);

    expect(mouseDown.defaultPrevented).toBe(true);
    expect(toggleBold).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });
});
