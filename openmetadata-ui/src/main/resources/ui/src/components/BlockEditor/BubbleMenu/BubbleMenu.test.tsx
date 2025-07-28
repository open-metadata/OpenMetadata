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
import BubbleMenu from './BubbleMenu';

const mockIsActive = jest.fn();

jest.mock('@tiptap/react', () => {
  const originalModule = jest.requireActual('@tiptap/react');

  return {
    ...originalModule,
    BubbleMenu: jest.fn().mockImplementation(({ children, ...props }) =>
      props?.shouldShow ? (
        <div data-testid="bubble-menu" {...props}>
          {children}
        </div>
      ) : null
    ),
  };
});

const mockToggleHeading = jest.fn().mockImplementation(() => {
  return {
    run: jest.fn(),
  };
});

const mockToggleBold = jest.fn().mockImplementation(() => {
  return {
    run: jest.fn(),
  };
});

const mockToggleItalic = jest.fn().mockImplementation(() => {
  return {
    run: jest.fn(),
  };
});

const mockToggleStrike = jest.fn().mockImplementation(() => {
  return {
    run: jest.fn(),
  };
});

const mockToggleCode = jest.fn().mockImplementation(() => {
  return {
    run: jest.fn(),
  };
});

const mockSetLink = jest.fn().mockImplementation(() => {
  return {
    run: jest.fn(),
  };
});

const mockToggleLink = jest.fn();
const mockChain = jest.fn().mockImplementation(() => {
  return {
    focus: jest.fn().mockImplementation(() => {
      return {
        toggleHeading: mockToggleHeading,
        toggleBold: mockToggleBold,
        toggleItalic: mockToggleItalic,
        toggleStrike: mockToggleStrike,
        toggleCode: mockToggleCode,
        setLink: mockSetLink,
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
  chain: mockChain,
  isActive: mockIsActive,
} as unknown as Editor;

const mockProps = {
  editor: mockEditor,
  toggleLink: mockToggleLink,
};

describe('BubbleMenu', () => {
  it('should render without crashing', () => {
    render(<BubbleMenu {...mockProps} />);

    expect(screen.getByTestId('menu-container')).toBeInTheDocument();

    expect(screen.getByLabelText('Heading 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Strike')).toBeInTheDocument();
    expect(screen.getByLabelText('Inline code')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
  });

  it('should call toggleHeading when clicking on Heading 1', async () => {
    render(<BubbleMenu {...mockProps} />);

    const heading1 = screen.getByLabelText('Heading 1');
    fireEvent.click(heading1);

    expect(mockToggleHeading).toHaveBeenCalled();
  });

  it('should call toggleBold when clicking on Bold', async () => {
    render(<BubbleMenu {...mockProps} />);

    const bold = screen.getByLabelText('Bold');
    fireEvent.click(bold);

    expect(mockToggleBold).toHaveBeenCalled();
  });

  it('should call toggleItalic when clicking on Italic', async () => {
    render(<BubbleMenu {...mockProps} />);

    const italic = screen.getByLabelText('Italic');
    fireEvent.click(italic);

    expect(mockToggleItalic).toHaveBeenCalled();
  });

  it('should call toggleStrike when clicking on Strike', async () => {
    render(<BubbleMenu {...mockProps} />);

    const strike = screen.getByLabelText('Strike');
    fireEvent.click(strike);

    expect(mockToggleStrike).toHaveBeenCalled();
  });

  it('should call toggleCode when clicking on Inline code', async () => {
    render(<BubbleMenu {...mockProps} />);

    const code = screen.getByLabelText('Inline code');
    fireEvent.click(code);

    expect(mockToggleCode).toHaveBeenCalled();
  });

  it('should call setLink and toggleLink when clicking on Link', async () => {
    render(<BubbleMenu {...mockProps} />);

    const link = screen.getByLabelText('Link');
    fireEvent.click(link);

    expect(mockSetLink).toHaveBeenCalled();
    expect(mockToggleLink).toHaveBeenCalled();
  });

  it('should call isActive for each menu item', () => {
    render(<BubbleMenu {...mockProps} />);

    expect(mockIsActive).toHaveBeenCalledTimes(8);
  });
});
