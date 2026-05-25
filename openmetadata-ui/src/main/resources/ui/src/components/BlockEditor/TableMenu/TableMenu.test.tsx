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
import tippy from 'tippy.js';
import TableMenu from './TableMenu';

jest.mock('tippy.js', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

const mockSetProps = jest.fn();
const mockShow = jest.fn();
const mockHide = jest.fn();
const mockDestroy = jest.fn();
const mockRun = jest.fn();

const createRect = (rect: Partial<DOMRect>): DOMRect => {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: jest.fn(),
    ...rect,
  } as DOMRect;
};

const mockBoundingClientRect = (element: Element, rect: DOMRect) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
};

const createChainMethods = () => {
  return {
    addRowAfter: jest.fn().mockReturnValue({ run: mockRun }),
    addColumnAfter: jest.fn().mockReturnValue({ run: mockRun }),
    deleteRow: jest.fn().mockReturnValue({ run: mockRun }),
    deleteColumn: jest.fn().mockReturnValue({ run: mockRun }),
    deleteTable: jest.fn().mockReturnValue({ run: mockRun }),
  };
};

const mockChain = jest.fn().mockImplementation(() => {
  return {
    focus: jest.fn().mockImplementation(() => createChainMethods()),
  };
});

const mockEditor = {
  view: {
    dom: document.createElement('div'),
  },
  isEditable: true,
  chain: mockChain,
} as unknown as Editor;

const renderTableMenu = () => {
  const rendered = render(<TableMenu editor={mockEditor} />);

  const safeUnmount = () => {
    const calls = (tippy as unknown as jest.Mock).mock.calls;
    const latestCall = calls[calls.length - 1];
    const tippyOptions = latestCall?.[1] as
      | {
          content?: HTMLElement;
        }
      | undefined;
    const menuContent = tippyOptions?.content;

    if (menuContent && !menuContent.isConnected) {
      rendered.container.appendChild(menuContent);
    }

    rendered.unmount();
  };

  return {
    ...rendered,
    safeUnmount,
  };
};

describe('TableMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tippy as unknown as jest.Mock).mockReturnValue({
      setProps: mockSetProps,
      show: mockShow,
      hide: mockHide,
      destroy: mockDestroy,
    });
  });

  it('anchors menu to clicked table cell instead of full table bounds', () => {
    const { safeUnmount } = renderTableMenu();

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'tableWrapper';

    try {
      const table = document.createElement('table');
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      const content = document.createElement('span');

      row.appendChild(cell);
      cell.appendChild(content);
      table.appendChild(row);
      tableWrapper.appendChild(table);
      document.body.appendChild(tableWrapper);

      const wrapperRect = createRect({
        x: 20,
        y: 10,
        top: 10,
        left: 20,
        right: 620,
        bottom: 410,
        width: 600,
        height: 400,
      });

      const cellRect = createRect({
        x: 280,
        y: 180,
        top: 180,
        left: 280,
        right: 460,
        bottom: 212,
        width: 180,
        height: 32,
      });

      mockBoundingClientRect(tableWrapper, wrapperRect);
      mockBoundingClientRect(cell, cellRect);

      content.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(mockSetProps).toHaveBeenCalledTimes(1);
      expect(mockShow).toHaveBeenCalledTimes(1);

      const tippyProps = mockSetProps.mock.calls[0][0] as {
        getReferenceClientRect: () => DOMRect;
      };

      expect(tippyProps.getReferenceClientRect()).toEqual(cellRect);
      expect(tippyProps.getReferenceClientRect()).not.toEqual(wrapperRect);
    } finally {
      tableWrapper.remove();
      safeUnmount();
    }
  });

  it('anchors to selected-cells bounding area when click target is table wrapper', () => {
    const { safeUnmount } = renderTableMenu();

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'tableWrapper';

    try {
      const firstSelectedCell = document.createElement('td');
      firstSelectedCell.className = 'selectedCell';

      const secondSelectedCell = document.createElement('td');
      secondSelectedCell.className = 'selectedCell';

      tableWrapper.appendChild(firstSelectedCell);
      tableWrapper.appendChild(secondSelectedCell);
      document.body.appendChild(tableWrapper);

      const firstRect = createRect({
        top: 100,
        left: 200,
        right: 250,
        bottom: 140,
        width: 50,
        height: 40,
      });

      const secondRect = createRect({
        top: 130,
        left: 260,
        right: 330,
        bottom: 170,
        width: 70,
        height: 40,
      });

      mockBoundingClientRect(firstSelectedCell, firstRect);
      mockBoundingClientRect(secondSelectedCell, secondRect);

      tableWrapper.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true })
      );

      const tippyProps = mockSetProps.mock.calls[0][0] as {
        getReferenceClientRect: () => DOMRect;
      };
      const rect = tippyProps.getReferenceClientRect();

      expect(rect.top).toBe(100);
      expect(rect.left).toBe(200);
      expect(rect.right).toBe(330);
      expect(rect.bottom).toBe(170);
      expect(rect.width).toBe(130);
      expect(rect.height).toBe(70);
    } finally {
      tableWrapper.remove();
      safeUnmount();
    }
  });

  it('falls back to table wrapper bounds when no selected cells exist', () => {
    const { safeUnmount } = renderTableMenu();

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'tableWrapper';

    try {
      document.body.appendChild(tableWrapper);

      const wrapperRect = createRect({
        x: 32,
        y: 48,
        top: 48,
        left: 32,
        right: 672,
        bottom: 448,
        width: 640,
        height: 400,
      });

      mockBoundingClientRect(tableWrapper, wrapperRect);

      tableWrapper.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true })
      );

      const tippyProps = mockSetProps.mock.calls[0][0] as {
        getReferenceClientRect: () => DOMRect;
      };

      expect(tippyProps.getReferenceClientRect()).toEqual(wrapperRect);
    } finally {
      tableWrapper.remove();
      safeUnmount();
    }
  });
});
