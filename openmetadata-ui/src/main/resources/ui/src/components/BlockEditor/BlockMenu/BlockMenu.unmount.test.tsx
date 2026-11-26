/*
 *  Copyright 2024 Collate.
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
import { render } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import BlockMenu from './BlockMenu';

// Kept apart from BlockMenu.test.tsx, which mocks React's hooks and so never
// runs the effect that hands the menu node to tippy.
jest.mock('tippy.js', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ destroy: jest.fn(), hide: jest.fn() }),
}));

const mockEditor = {
  view: { dom: document.createElement('div') },
  isEditable: true,
} as unknown as Editor;

describe('BlockMenu unmount', () => {
  it('unmounts on its own while its parent stays mounted', () => {
    const Host = ({ showMenu }: { showMenu: boolean }) => (
      <div>{showMenu && <BlockMenu editor={mockEditor} />}</div>
    );
    const { rerender } = render(<Host showMenu />);

    // The editor turning read-only unmounts the menu but keeps the editor.
    expect(() => rerender(<Host showMenu={false} />)).not.toThrow();
  });
});
