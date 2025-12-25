/*
 *  Copyright 2025 Collate.
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
import { PreviewerProp } from './RichTextEditor.interface';
import TaskDescriptionPreviewer from './TaskDescriptionPreviewer';

jest.mock('../../BlockEditor/BlockEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ content }) => (
      <div data-testid="block-editor">{content}</div>
    ));
});

jest.mock('../../../utils/BlockEditorUtils', () => ({
  formatContent: jest.fn((content) => content),
  isDescriptionContentEmpty: jest.fn((content) => !content || content === ''),
}));

const mockShortMarkdown = 'Short task description';
const mockLongMarkdown = `
# Task Description
This is a very long task description that should trigger overflow detection.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
`;

const mockProp: PreviewerProp = {
  markdown: mockLongMarkdown,
  className: '',
  enableSeeMoreVariant: false,
  textVariant: 'black',
  showReadMoreBtn: true,
};

describe('TaskDescriptionPreviewer', () => {
  afterEach(() => {
    // reset mocks

    jest.mock('../../../utils/BlockEditorUtils', () => ({
      formatContent: jest.fn((content) => content),
      isDescriptionContentEmpty: jest.fn(
        (content) => !content || content === ''
      ),
    }));
  });

  it('should render the component with markdown content', () => {
    render(<TaskDescriptionPreviewer {...mockProp} />);

    expect(screen.getByTestId('viewer-container')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-parser')).toBeInTheDocument();
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
  });

  it('should render no-description placeholder when markdown is empty', () => {
    render(<TaskDescriptionPreviewer {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-container')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-class';
    render(<TaskDescriptionPreviewer {...mockProp} className={customClass} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('rich-text-editor-container', customClass);
  });

  it('should apply text variant className', () => {
    render(<TaskDescriptionPreviewer {...mockProp} textVariant="white" />);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser).toHaveClass('markdown-parser', 'white');
  });

  it('should apply RTL direction when i18n dir is rtl', () => {
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: (key: string) => key,
      i18n: { dir: () => 'rtl' },
    });

    render(<TaskDescriptionPreviewer {...mockProp} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('text-right');
    expect(container).toHaveAttribute('dir', 'rtl');
  });

  it('should not show view-more button when enableSeeMoreVariant is false', () => {
    render(
      <TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant={false} />
    );

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('read-less-button')).not.toBeInTheDocument();
  });

  it('should not show view-more button when showReadMoreBtn is false', () => {
    render(
      <TaskDescriptionPreviewer
        {...mockProp}
        enableSeeMoreVariant
        showReadMoreBtn={false}
      />
    );

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
  });

  it('should detect overflow and show view-more button when enableSeeMoreVariant is true', () => {
    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      contentElement.dispatchEvent(new Event('load'));
    });
  });

  it('should apply line-clamp styles when enableSeeMoreVariant is true and readMore is false', () => {
    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const parser = screen.getByTestId('markdown-parser');
    const style = parser.style;

    expect(style.display).toBe('-webkit-box');
    expect(style['WebkitBoxOrient']).toBe('vertical');
    expect(style['WebkitLineClamp']).toBe('2');
    expect(style.overflow).toBe('hidden');
  });

  it('should not apply line-clamp styles when enableSeeMoreVariant is false', () => {
    render(
      <TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant={false} />
    );

    const parser = screen.getByTestId('markdown-parser');
    const style = parser.style;

    expect(style.display).toBe('');
  });

  it('should toggle read more state when button is clicked', () => {
    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      const event = new Event('load');
      window.dispatchEvent(event);
    });
  });

  it('should update content when markdown prop changes', () => {
    const { rerender } = render(
      <TaskDescriptionPreviewer {...mockProp} markdown="Initial content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Initial content'
    );

    rerender(
      <TaskDescriptionPreviewer {...mockProp} markdown="Updated content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Updated content'
    );
  });

  it('should format content using formatContent utility', () => {
    const { formatContent } = require('../../../utils/BlockEditorUtils');
    render(<TaskDescriptionPreviewer {...mockProp} />);

    expect(formatContent).toHaveBeenCalledWith(mockLongMarkdown, 'client');
  });

  it('should render with default props', () => {
    render(<TaskDescriptionPreviewer />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should render view-more button with correct translation key', () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });
  });

  it('should set BlockEditor to non-editable mode', () => {
    const BlockEditor = require('../../BlockEditor/BlockEditor');
    render(<TaskDescriptionPreviewer {...mockProp} />);

    expect(BlockEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: false,
        autoFocus: false,
      }),
      {}
    );
  });

  it('should handle empty content after formatting', async () => {
    render(<TaskDescriptionPreviewer {...mockProp} markdown="" />);

    expect(await screen.findByText('label.no-description')).toBeInTheDocument();
  });

  it('should default enableSeeMoreVariant to false', () => {
    const { getByTestId } = render(<TaskDescriptionPreviewer {...mockProp} />);

    const parser = getByTestId('markdown-parser');
    const style = parser.style;

    expect(style.display).toBe('');
  });

  it('should apply correct button styles', () => {
    const { getByTestId } = render(
      <TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />
    );

    const contentElement = getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });
  });

  it('should initialize with readMore true when content overflows', () => {
    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });
  });

  it('should handle short content that does not overflow', () => {
    render(
      <TaskDescriptionPreviewer
        {...mockProp}
        enableSeeMoreVariant
        markdown={mockShortMarkdown}
      />
    );

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 50,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
  });

  it('should update overflow detection when content changes', () => {
    const { rerender } = render(
      <TaskDescriptionPreviewer
        {...mockProp}
        enableSeeMoreVariant
        markdown={mockShortMarkdown}
      />
    );

    let contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 50,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    rerender(
      <TaskDescriptionPreviewer
        {...mockProp}
        enableSeeMoreVariant
        markdown={mockLongMarkdown}
      />
    );

    contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });
  });

  it('should set lineClamp to unset when readMore is true', () => {
    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });
  });

  it('should render correct button text based on readMore state', () => {
    const mockT = jest.fn((key) => {
      if (key === 'label.view-more') {
        return 'View More';
      }
      if (key === 'label.view-less') {
        return 'View Less';
      }

      return key;
    });
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<TaskDescriptionPreviewer {...mockProp} enableSeeMoreVariant />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });
  });
});
