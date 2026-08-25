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
import MentionList from './MentionList';

jest.mock('../../../../components/common/ProfilePicture/ProfilePicture', () => {
  return jest
    .fn()
    .mockImplementation(({ name }) => (
      <div data-testid={`profile-picture-${name}`}>{name}</div>
    ));
});

const mockCommand = jest.fn();
const mockView = {} as EditorView;

const mockItems: SuggestionItem[] = [
  {
    id: '1',
    name: 'John Doe',
    fqn: 'john.doe',
    label: 'John Doe',
    type: 'user',
    href: '/user/john.doe',
  },
  {
    id: '2',
    name: 'Jane Smith',
    fqn: 'jane.smith',
    label: 'Jane Smith',
    type: 'user',
    href: '/user/jane.smith',
  },
];

const mockProps: SuggestionProps<SuggestionItem> = {
  items: mockItems,
  command: mockCommand,
  editor: {} as SuggestionProps['editor'],
  range: {} as SuggestionProps['range'],
  query: '',
  text: '',
  clientRect: null,
  decorationNode: null,
};

describe('MentionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render mention items correctly', () => {
    const { container } = render(<MentionList {...mockProps} />);

    const mentionItems = container.querySelectorAll('.mention-item');

    expect(mentionItems).toHaveLength(2);
  });

  it('should render profile pictures for each user', () => {
    render(<MentionList {...mockProps} />);

    expect(screen.getByTestId('profile-picture-John Doe')).toBeInTheDocument();
    expect(
      screen.getByTestId('profile-picture-Jane Smith')
    ).toBeInTheDocument();
  });

  it('should render empty list when no items provided', () => {
    const emptyProps = { ...mockProps, items: [] };
    const { container } = render(<MentionList {...emptyProps} />);

    const mentionItems = container.querySelectorAll('.mention-item');

    expect(mentionItems).toHaveLength(0);
  });

  describe('Security fix: isEmpty check', () => {
    it('should return false from onKeyDown when items array is empty', () => {
      const ref = React.createRef<ExtensionRef>();
      const emptyProps = { ...mockProps, items: [] };
      render(<MentionList ref={ref} {...emptyProps} />);

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
      render(<MentionList ref={ref} {...emptyProps} />);

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
      render(<MentionList ref={ref} {...emptyProps} />);

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
      render(<MentionList ref={ref} {...emptyProps} />);

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
      render(<MentionList ref={ref} {...emptyProps} />);

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
      render(<MentionList ref={ref} {...mockProps} />);

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
      render(<MentionList ref={ref} {...mockProps} />);

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
      render(<MentionList ref={ref} {...mockProps} />);

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
      render(<MentionList ref={ref} {...mockProps} />);

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
