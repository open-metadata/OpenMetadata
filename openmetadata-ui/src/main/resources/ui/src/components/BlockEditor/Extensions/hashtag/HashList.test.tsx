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
import { act, render, screen } from '@testing-library/react';
import { EditorView } from '@tiptap/pm/view';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import React from 'react';
import { ExtensionRef, SuggestionItem } from '../../BlockEditor.interface';
import HashList from './HashList';

const mockCommand = jest.fn();
const mockView = {} as EditorView;

const mockItems: Array<
  SuggestionItem & { breadcrumbs: { name: string; url: string }[] }
> = [
  {
    id: '1',
    name: 'Table 1',
    fqn: 'database.schema.table1',
    label: 'Table 1',
    type: 'table',
    href: '/table/1',
    breadcrumbs: [
      { name: 'Database', url: '/database' },
      { name: 'Schema', url: '/schema' },
    ],
  },
  {
    id: '2',
    name: 'Table 2',
    fqn: 'database.schema.table2',
    label: 'Table 2',
    type: 'table',
    href: '/table/2',
    breadcrumbs: [
      { name: 'Database', url: '/database' },
      { name: 'Schema', url: '/schema' },
    ],
  },
];

const mockProps: SuggestionProps<
  SuggestionItem & { breadcrumbs: { name: string; url: string }[] }
> = {
  items: mockItems,
  command: mockCommand,
  editor: {} as SuggestionProps['editor'],
  range: {} as SuggestionProps['range'],
  query: '',
  text: '',
  clientRect: null,
  decorationNode: null,
};

describe('HashList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render hashtag items correctly', () => {
    render(<HashList {...mockProps} />);

    expect(screen.getByTestId('hash-mention-Table 1')).toBeInTheDocument();
    expect(screen.getByTestId('hash-mention-Table 2')).toBeInTheDocument();
  });

  it('should render breadcrumbs for each item', () => {
    render(<HashList {...mockProps} />);

    const breadcrumbElements = screen.getAllByText('Database/Schema');

    expect(breadcrumbElements).toHaveLength(2);
  });

  it('should render empty list when no items provided', () => {
    const emptyProps = { ...mockProps, items: [] };
    const { container } = render(<HashList {...emptyProps} />);

    const hashtagItems = container.querySelectorAll('.hashtag-item');

    expect(hashtagItems).toHaveLength(0);
  });

  describe('Security fix: isEmpty check', () => {
    it('should return false from onKeyDown when items array is empty', () => {
      const ref = React.createRef<ExtensionRef>();
      const emptyProps = { ...mockProps, items: [] };
      render(<HashList ref={ref} {...emptyProps} />);

      const mockEvent = { key: 'ArrowUp' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      const result = ref.current?.onKeyDown(keyDownProps);

      expect(result).toBe(false);
    });

    it('should return false from onKeyDown for ArrowDown when items array is empty', () => {
      const ref = React.createRef<ExtensionRef>();
      const emptyProps = { ...mockProps, items: [] };
      render(<HashList ref={ref} {...emptyProps} />);

      const mockEvent = { key: 'ArrowDown' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      const result = ref.current?.onKeyDown(keyDownProps);

      expect(result).toBe(false);
    });

    it('should return false from onKeyDown for Enter when items array is empty', () => {
      const ref = React.createRef<ExtensionRef>();
      const emptyProps = { ...mockProps, items: [] };
      render(<HashList ref={ref} {...emptyProps} />);

      const mockEvent = { key: 'Enter' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      const result = ref.current?.onKeyDown(keyDownProps);

      expect(result).toBe(false);
      expect(mockCommand).not.toHaveBeenCalled();
    });
  });

  describe('Security fix: optional chaining for array access', () => {
    it('should handle upHandler safely with empty items', () => {
      const ref = React.createRef<ExtensionRef>();
      const emptyProps = { ...mockProps, items: [] };
      render(<HashList ref={ref} {...emptyProps} />);

      const mockEvent = { key: 'ArrowUp' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      expect(() => ref.current?.onKeyDown(keyDownProps)).not.toThrow();
    });

    it('should handle downHandler safely with empty items', () => {
      const ref = React.createRef<ExtensionRef>();
      const emptyProps = { ...mockProps, items: [] };
      render(<HashList ref={ref} {...emptyProps} />);

      const mockEvent = { key: 'ArrowDown' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      expect(() => ref.current?.onKeyDown(keyDownProps)).not.toThrow();
    });
  });

  describe('Keyboard navigation', () => {
    it('should handle ArrowUp key press', () => {
      const ref = React.createRef<ExtensionRef>();
      render(<HashList ref={ref} {...mockProps} />);

      const mockEvent = { key: 'ArrowUp' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      let result: boolean | undefined;
      act(() => {
        result = ref.current?.onKeyDown(keyDownProps);
      });

      expect(result).toBe(true);
    });

    it('should handle ArrowDown key press', () => {
      const ref = React.createRef<ExtensionRef>();
      render(<HashList ref={ref} {...mockProps} />);

      const mockEvent = { key: 'ArrowDown' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      let result: boolean | undefined;
      act(() => {
        result = ref.current?.onKeyDown(keyDownProps);
      });

      expect(result).toBe(true);
    });

    it('should handle Enter key press and call command', () => {
      const ref = React.createRef<ExtensionRef>();
      render(<HashList ref={ref} {...mockProps} />);

      const mockEvent = { key: 'Enter' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      const result = ref.current?.onKeyDown(keyDownProps);

      expect(result).toBe(true);
      expect(mockCommand).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should return false for unhandled keys', () => {
      const ref = React.createRef<ExtensionRef>();
      render(<HashList ref={ref} {...mockProps} />);

      const mockEvent = { key: 'Escape' } as KeyboardEvent;
      const keyDownProps: SuggestionKeyDownProps = {
        view: mockView,
        event: mockEvent,
        range: mockProps.range,
      };

      const result = ref.current?.onKeyDown(keyDownProps);

      expect(result).toBe(false);
    });
  });
});
