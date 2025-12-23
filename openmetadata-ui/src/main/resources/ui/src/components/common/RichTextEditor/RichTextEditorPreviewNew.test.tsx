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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { PreviewerProp } from './RichTextEditor.interface';
import RichTextEditorPreviewNew from './RichTextEditorPreviewNew';

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

const mockLongMarkdown = `
# Very Long Content
This is a very long piece of content that should trigger the "read more" functionality.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
`;

const mockProp: PreviewerProp = {
  markdown: mockLongMarkdown,
  className: '',
  enableSeeMoreVariant: true,
  textVariant: 'black',
  isDescriptionExpanded: false,
  maxLineLength: '2',
};

describe('RichTextEditorPreviewNew', () => {
  let mockResizeObserver: jest.Mock;
  let resizeCallback: ResizeObserverCallback;

  beforeEach(() => {
    mockResizeObserver = jest.fn().mockImplementation((callback) => {
      resizeCallback = callback;

      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
      };
    });
    global.ResizeObserver =
      mockResizeObserver as unknown as typeof ResizeObserver;
  });

  it('should render the component with markdown content', () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    expect(screen.getByTestId('viewer-container')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-parser')).toBeInTheDocument();
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
  });

  it('should render no-description placeholder when markdown is empty', () => {
    render(<RichTextEditorPreviewNew {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-container')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-class';
    render(<RichTextEditorPreviewNew {...mockProp} className={customClass} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('rich-text-editor-container', customClass);
  });

  it('should apply text variant className', () => {
    render(<RichTextEditorPreviewNew {...mockProp} textVariant="white" />);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser).toHaveClass('markdown-parser', 'white');
  });

  it('should apply RTL direction when i18n dir is rtl', () => {
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: (key: string) => key,
      i18n: { dir: () => 'rtl' },
    });

    render(<RichTextEditorPreviewNew {...mockProp} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('text-right');
    expect(container).toHaveAttribute('dir', 'rtl');
  });

  it('should apply line clamp styles when not expanded', () => {
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="3" />);

    const parser = screen.getByTestId('markdown-parser');
    const style = parser.style;

    expect(style.display).toBe('-webkit-box');
    expect(style.WebkitBoxOrient).toBe('vertical');
    expect(style.WebkitLineClamp).toBe('3');
    expect(style.overflow).toBe('hidden');
  });

  it('should not apply line clamp styles when expanded', () => {
    render(
      <RichTextEditorPreviewNew
        {...mockProp}
        isDescriptionExpanded
        maxLineLength="2"
      />
    );

    const parser = screen.getByTestId('markdown-parser');
    const style = parser.style;

    expect(style.display).toBe('');
    expect(style.WebkitBoxOrient).not.toBeDefined();
    expect(style.overflow).toBe('');
  });

  it('should detect overflow and show view-more button', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

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
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });
  });

  it('should not show view-more button when content does not overflow', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should not show view-more button when enableSeeMoreVariant is false', async () => {
    render(
      <RichTextEditorPreviewNew {...mockProp} enableSeeMoreVariant={false} />
    );

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
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should toggle read more state when button is clicked', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

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
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });

    const readMoreButton = screen.getByTestId('read-more-button');

    act(() => {
      fireEvent.click(readMoreButton);
    });

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();

    const readLessButton = screen.getByTestId('read-less-button');

    act(() => {
      fireEvent.click(readLessButton);
    });

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('should update content when markdown prop changes', () => {
    const { rerender } = render(
      <RichTextEditorPreviewNew {...mockProp} markdown="Initial content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Initial content'
    );

    rerender(
      <RichTextEditorPreviewNew {...mockProp} markdown="Updated content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Updated content'
    );
  });

  it('should update read more state when isDescriptionExpanded prop changes', async () => {
    const { rerender } = render(
      <RichTextEditorPreviewNew {...mockProp} isDescriptionExpanded={false} />
    );

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
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });

    rerender(<RichTextEditorPreviewNew {...mockProp} isDescriptionExpanded />);

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should handle different maxLineLength values', () => {
    const { rerender } = render(
      <RichTextEditorPreviewNew {...mockProp} maxLineLength="2" />
    );

    let parser = screen.getByTestId('markdown-parser');

    expect(parser.style.WebkitLineClamp).toBe('2');

    rerender(<RichTextEditorPreviewNew {...mockProp} maxLineLength="5" />);

    parser = screen.getByTestId('markdown-parser');

    expect(parser.style.WebkitLineClamp).toBe('5');
  });

  it('should observe resize events', () => {
    const { unmount } = render(<RichTextEditorPreviewNew {...mockProp} />);

    const observeInstance = mockResizeObserver.mock.results[0].value;

    expect(observeInstance.observe).toHaveBeenCalled();

    unmount();

    expect(observeInstance.disconnect).toHaveBeenCalled();
  });

  it('should handle ResizeObserver cleanup on unmount', () => {
    const { unmount } = render(<RichTextEditorPreviewNew {...mockProp} />);

    const disconnectMock = mockResizeObserver.mock.results[0].value.disconnect;

    unmount();

    expect(disconnectMock).toHaveBeenCalled();
  });

  it('should render with default props', () => {
    render(<RichTextEditorPreviewNew />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should render view-more button with correct translation key', async () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<RichTextEditorPreviewNew {...mockProp} />);

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
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(mockT).toHaveBeenCalledWith('label.view-more');
    });
  });

  it('should render view-less button with correct translation key', async () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<RichTextEditorPreviewNew {...mockProp} />);

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
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      const button = screen.getByTestId('read-more-button');
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockT).toHaveBeenCalledWith('label.view-less');
    });
  });

  it('should handle empty content after formatting', () => {
    render(<RichTextEditorPreviewNew {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should calculate maxHeight based on maxLineLength', () => {
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="4" />);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser.style.maxHeight).toBe('8em');
  });
});
