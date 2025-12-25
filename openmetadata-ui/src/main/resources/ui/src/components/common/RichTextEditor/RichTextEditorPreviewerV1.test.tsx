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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DESCRIPTION_MAX_PREVIEW_CHARACTERS } from '../../../constants/constants';
import { PreviewerProp } from './RichTextEditor.interface';
import RichTextEditorPreviewerV1 from './RichTextEditorPreviewerV1';

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

jest.mock('../../../utils/CommonUtils', () => ({
  getTrimmedContent: jest.fn((content, maxLength) =>
    content.slice(0, maxLength)
  ),
}));

const mockShortMarkdown = 'Short description text';
const mockLongMarkdown = `
This is a very long piece of content that exceeds the maximum preview length.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
Nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.
`.repeat(10);

const mockProp: PreviewerProp = {
  markdown: mockLongMarkdown,
  className: '',
  enableSeeMoreVariant: true,
  textVariant: 'black',
  showReadMoreBtn: true,
  maxLength: DESCRIPTION_MAX_PREVIEW_CHARACTERS,
  isDescriptionExpanded: false,
  reducePreviewLineClass: 'line-clamp-2',
};

describe('RichTextEditorPreviewerV1', () => {
  it('should render the component with markdown content', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} />);

    expect(screen.getByTestId('viewer-container')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-parser')).toBeInTheDocument();
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
  });

  it('should render no-description placeholder when markdown is empty', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-container')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-class';
    render(<RichTextEditorPreviewerV1 {...mockProp} className={customClass} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('rich-text-editor-container', customClass);
  });

  it('should apply text variant className', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} textVariant="white" />);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser).toHaveClass('markdown-parser', 'white');
  });

  it('should apply reducePreviewLineClass when not expanded', () => {
    render(
      <RichTextEditorPreviewerV1
        {...mockProp}
        reducePreviewLineClass="custom-line-clamp"
      />
    );

    const parser = screen.getByTestId('markdown-parser');

    expect(parser).toHaveClass('custom-line-clamp');
  });

  it('should not apply reducePreviewLineClass when expanded', () => {
    render(
      <RichTextEditorPreviewerV1
        {...mockProp}
        isDescriptionExpanded
        reducePreviewLineClass="custom-line-clamp"
      />
    );

    const parser = screen.getByTestId('markdown-parser');

    expect(parser).not.toHaveClass('custom-line-clamp');
  });

  it('should apply RTL direction when i18n dir is rtl', () => {
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: (key: string) => key,
      i18n: { dir: () => 'rtl' },
    });

    render(<RichTextEditorPreviewerV1 {...mockProp} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('text-right');
    expect(container).toHaveAttribute('dir', 'rtl');
  });

  it('should show read more button when content exceeds maxLength', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('should not show read more button when content is within maxLength', () => {
    render(
      <RichTextEditorPreviewerV1
        {...mockProp}
        markdown={mockShortMarkdown}
        maxLength={100}
      />
    );

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
  });

  it('should not show read more button when enableSeeMoreVariant is false', () => {
    render(
      <RichTextEditorPreviewerV1 {...mockProp} enableSeeMoreVariant={false} />
    );

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
  });

  it('should not show read more button when showReadMoreBtn is false', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} showReadMoreBtn={false} />);

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
  });

  it('should toggle read more state when button is clicked', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('read-more-button'));
    });

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('read-less-button'));
    });

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('should render trimmed content when not expanded', () => {
    const { getTrimmedContent } = require('../../../utils/CommonUtils');
    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    expect(getTrimmedContent).toHaveBeenCalledWith(mockLongMarkdown, 50);
  });

  it('should render full content when expanded', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    act(() => {
      fireEvent.click(screen.getByTestId('read-more-button'));
    });

    const blockEditor = screen.getByTestId('block-editor');

    // Normalize whitespace in the expected markdown since textContent collapses newlines and spaces
    expect(blockEditor).toHaveTextContent(
      mockLongMarkdown.replace(/\s+/g, ' ').trim()
    );
  });

  it('should update content when markdown prop changes', () => {
    const { rerender } = render(
      <RichTextEditorPreviewerV1 {...mockProp} markdown="Initial content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Initial content'
    );

    rerender(
      <RichTextEditorPreviewerV1 {...mockProp} markdown="Updated content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Updated content'
    );
  });

  it('should format content using formatContent utility', () => {
    const { formatContent } = require('../../../utils/BlockEditorUtils');
    render(<RichTextEditorPreviewerV1 {...mockProp} />);

    expect(formatContent).toHaveBeenCalledWith(mockLongMarkdown, 'client');
  });

  it('should initialize with expanded state based on isDescriptionExpanded prop', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} isDescriptionExpanded />);

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();
  });

  it('should update expanded state when isDescriptionExpanded prop changes', () => {
    const { rerender } = render(
      <RichTextEditorPreviewerV1 {...mockProp} isDescriptionExpanded={false} />
    );

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();

    rerender(<RichTextEditorPreviewerV1 {...mockProp} isDescriptionExpanded />);

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();
  });

  it('should render with default props', () => {
    render(<RichTextEditorPreviewerV1 />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should render read more button with correct translation', () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    expect(mockT).toHaveBeenCalledWith('label.more-lowercase');
  });

  it('should render read less button with correct translation', () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    act(() => {
      fireEvent.click(screen.getByTestId('read-more-button'));
    });

    expect(mockT).toHaveBeenCalledWith('label.less-lowercase');
  });

  it('should pass extensionOptions to BlockEditor', () => {
    const BlockEditor = require('../../BlockEditor/BlockEditor');
    const extensionOptions = {
      enableHandlebars: true,
      coreExtensions: true,
      utilityExtensions: true,
      tableExtensions: true,
      advancedContextExtensions: true,
    };

    render(
      <RichTextEditorPreviewerV1
        {...mockProp}
        extensionOptions={extensionOptions}
      />
    );

    expect(BlockEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionOptions,
      }),
      {}
    );
  });

  it('should render ellipsis after trimmed content', () => {
    const { getTrimmedContent } = require('../../../utils/CommonUtils');
    getTrimmedContent.mockReturnValue('Trimmed content');

    render(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Trimmed content...'
    );
  });

  it('should handle empty content after formatting', () => {
    render(<RichTextEditorPreviewerV1 {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should set BlockEditor to non-editable mode', () => {
    const BlockEditor = require('../../BlockEditor/BlockEditor');
    render(<RichTextEditorPreviewerV1 {...mockProp} />);

    expect(BlockEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: false,
        autoFocus: false,
      }),
      {}
    );
  });

  it('should handle very long markdown with default maxLength', () => {
    const veryLongMarkdown = 'a'.repeat(5000);
    render(
      <RichTextEditorPreviewerV1
        {...mockProp}
        enableSeeMoreVariant
        markdown={veryLongMarkdown}
      />
    );

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('should calculate hasReadMore correctly based on markdown length', () => {
    const markdown = 'a'.repeat(100);
    const { rerender } = render(
      <RichTextEditorPreviewerV1
        {...mockProp}
        markdown={markdown}
        maxLength={150}
      />
    );

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();

    rerender(
      <RichTextEditorPreviewerV1
        {...mockProp}
        markdown={markdown}
        maxLength={50}
      />
    );

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('should maintain readMore state across re-renders', () => {
    const { rerender } = render(
      <RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />
    );

    act(() => {
      fireEvent.click(screen.getByTestId('read-more-button'));
    });

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();

    rerender(<RichTextEditorPreviewerV1 {...mockProp} maxLength={50} />);

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();
  });
});
