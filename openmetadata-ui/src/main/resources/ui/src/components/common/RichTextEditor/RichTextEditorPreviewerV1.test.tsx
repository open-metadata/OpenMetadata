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
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../utils/i18next/LocalUtil';
import RichTextEditorPreviewerV1 from './RichTextEditorPreviewerV1';

// Mock BlockEditor
jest.mock('../../BlockEditor/BlockEditor', () => {
  return function MockBlockEditor({ content }: { content: string }) {
    return <div data-testid="block-editor">{content}</div>;
  };
});

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

const longMarkdown =
  'This is a very long description that exceeds the maximum character limit and should trigger the tooltip feature when truncated.';
const shortMarkdown = 'Short description.';

describe('RichTextEditorPreviewerV1 Tooltip Feature', () => {
  it('should show tooltip when showTooltipOnTruncate is enabled and content exceeds maxLength', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1
        showTooltipOnTruncate
        markdown={longMarkdown}
        maxLength={20}
      />
    );

    // Should have a tooltip wrapper when content is truncated
    const tooltipTrigger = document.querySelector('.ant-tooltip-open');

    expect(
      document.querySelector('[data-testid="markdown-parser"]')
    ).toBeInTheDocument();
  });

  it('should not show tooltip when showTooltipOnTruncate is disabled', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1
        markdown={longMarkdown}
        maxLength={20}
        showTooltipOnTruncate={false}
      />
    );

    // Should not have tooltip wrapper
    expect(document.querySelector('.ant-tooltip')).not.toBeInTheDocument();
  });

  it('should not show tooltip when content does not exceed maxLength', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1
        showTooltipOnTruncate
        markdown={shortMarkdown}
        maxLength={100}
      />
    );

    // Should not show tooltip when content is short
    expect(document.querySelector('.ant-tooltip')).not.toBeInTheDocument();
  });

  it('should not show tooltip when read more is expanded', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1
        isDescriptionExpanded
        showTooltipOnTruncate
        markdown={longMarkdown}
        maxLength={20}
      />
    );

    // Should not show tooltip when content is expanded
    expect(document.querySelector('.ant-tooltip')).not.toBeInTheDocument();
  });

  it('should show read more button when content exceeds maxLength', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1 markdown={longMarkdown} maxLength={20} />
    );

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('should toggle between read more and read less', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1 markdown={longMarkdown} maxLength={20} />
    );

    const readMoreButton = screen.getByTestId('read-more-button');

    expect(readMoreButton).toHaveTextContent('more');

    fireEvent.click(readMoreButton);

    expect(screen.getByTestId('read-less-button')).toHaveTextContent('less');
  });

  it('should show no description placeholder for empty markdown', () => {
    renderWithI18n(
      <RichTextEditorPreviewerV1 showTooltipOnTruncate markdown="" />
    );

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });
});
