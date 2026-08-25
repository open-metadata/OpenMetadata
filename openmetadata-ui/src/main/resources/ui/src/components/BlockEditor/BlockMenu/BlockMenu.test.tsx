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
import { fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import BlockMenu from './BlockMenu';

const mockDeleteSelection = jest.fn();
const mockChain = jest.fn().mockImplementation(() => {
  return {
    insertContentAt: jest.fn().mockImplementation(() => {
      return {
        focus: jest.fn().mockImplementation(() => {
          return {
            run: jest.fn(),
          };
        }),
      };
    }),
  };
});

jest.mock('../Extensions/BlockAndDragDrop/helpers', () => {
  return {
    nodeDOMAtCoords: jest.fn().mockImplementation(() => {
      return document.createElement('div');
    }),
    nodePosAtDOM: jest.fn().mockImplementation(() => {
      return 1;
    }),
  };
});

jest.mock('tippy.js', () => {
  return {
    Instance: jest.fn().mockImplementation(() => {
      return {
        destroy: jest.fn(),
      };
    }),
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        destroy: jest.fn(),
      };
    }),
  };
});

jest.mock('react', () => {
  const originReact = jest.requireActual('react');

  return {
    ...originReact,
    useEffect: jest.fn(),
    useRef: jest.fn().mockImplementation(() => {
      return {
        current: {
          destroy: jest.fn(),
          hide: jest.fn(),
          remove: jest.fn(),
          style: {
            visibility: 'visible',
          },
          setAttribute: jest.fn(),
        },
      };
    }),
  };
});

const mockEditor = {
  view: {
    state: {
      doc: {},
      selection: {
        to: 1,
        content: jest.fn().mockImplementation(() => {
          return {
            content: {
              firstChild: {
                toJSON: jest.fn(),
              },
            },
          };
        }),
      },
    },
  },
  commands: {
    deleteSelection: mockDeleteSelection,
  },
  chain: mockChain,
} as unknown as Editor;

describe('BlockMenu', () => {
  it('should render without crashing', () => {
    const spyAddEventListener = jest.spyOn(document, 'addEventListener');

    render(<BlockMenu editor={mockEditor} />);

    expect(screen.getByTestId('menu-container')).toBeInTheDocument();
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
    expect(screen.getByTestId('duplicate-btn')).toBeInTheDocument();

    expect(spyAddEventListener).toHaveBeenCalled();
  });

  it('delete action should work', async () => {
    render(<BlockMenu editor={mockEditor} />);

    const deleteBtn = screen.getByTestId('delete-btn');

    fireEvent.click(deleteBtn);

    expect(mockDeleteSelection).toHaveBeenCalled();
  });

  it('duplicate action should work', async () => {
    render(<BlockMenu editor={mockEditor} />);

    const duplicateBtn = screen.getByTestId('duplicate-btn');

    fireEvent.click(duplicateBtn);

    expect(mockChain).toHaveBeenCalled();
  });
});
