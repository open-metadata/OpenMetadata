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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DescriptionSection from './DescriptionSection';

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: any) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Mock SVG icons
jest.mock('../../../assets/svg/close-icon.svg', () => ({
  ReactComponent: () => <div data-testid="close-icon-svg">Close</div>,
}));
jest.mock('../../../assets/svg/edit.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">Edit</div>,
}));
jest.mock('../../../assets/svg/tick.svg', () => ({
  ReactComponent: () => <div data-testid="tick-icon-svg">Tick</div>,
}));

// Mock RichTextEditorPreviewerV1 to render markdown within a .markdown-parser element
jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockImplementation(({ markdown }) => (
    <div className="markdown-parser" data-testid="markdown-parser">
      {markdown}
    </div>
  ));
});

describe('DescriptionSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - Empty Description', () => {
    it('renders title and no-data placeholder when description is empty', () => {
      const { container } = render(<DescriptionSection />);

      expect(screen.getByText('label.description')).toBeInTheDocument();
      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
      expect(
        container.querySelector('.description-section')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.description-header')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.description-content')
      ).toBeInTheDocument();
    });

    it('shows edit control when showEditButton is true and onDescriptionUpdate provided', () => {
      render(<DescriptionSection onDescriptionUpdate={jest.fn()} />);

      const clickable = document.querySelector(
        '.description-header .cursor-pointer'
      ) as HTMLElement | null;

      expect(clickable).toBeTruthy();
    });

    it('does not show edit control when showEditButton is false', () => {
      render(
        <DescriptionSection
          showEditButton={false}
          onDescriptionUpdate={jest.fn()}
        />
      );

      const clickable = document.querySelector(
        '.description-header .cursor-pointer'
      ) as HTMLElement | null;

      expect(clickable).toBeNull();
    });

    it('does not show edit control when onDescriptionUpdate is not provided', () => {
      render(<DescriptionSection showEditButton />);

      const clickable = document.querySelector(
        '.description-header .cursor-pointer'
      ) as HTMLElement | null;

      expect(clickable).toBeNull();
    });
  });

  describe('Edit Mode - Empty Description', () => {
    it('enters edit mode, shows textarea, and cancels back to view', () => {
      render(<DescriptionSection onDescriptionUpdate={jest.fn()} />);

      const editTrigger = document.querySelector(
        '.description-header .cursor-pointer'
      ) as HTMLElement;
      fireEvent.click(editTrigger);

      expect(
        document.querySelector('.inline-edit-container')
      ).toBeInTheDocument();
      expect(
        document.querySelector('.description-textarea')
      ).toBeInTheDocument();
      expect(document.querySelector('.edit-actions')).toBeInTheDocument();

      const cancel = document.querySelector(
        '.edit-actions .cursor-pointer'
      ) as HTMLElement; // first is cancel
      fireEvent.click(cancel);

      expect(
        document.querySelector('.inline-edit-container')
      ).not.toBeInTheDocument();
      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('saves edited description and exits edit mode', async () => {
      const onUpdate = jest.fn().mockResolvedValue(undefined);

      render(<DescriptionSection onDescriptionUpdate={onUpdate} />);

      const editTrigger = document.querySelector(
        '.description-header .cursor-pointer'
      ) as HTMLElement;
      fireEvent.click(editTrigger);

      const textarea = document.querySelector(
        '.description-textarea'
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New description' } });

      const actionButtons = document.querySelectorAll(
        '.edit-actions .cursor-pointer'
      );
      const save = actionButtons[1] as HTMLElement; // second is save
      fireEvent.click(save);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith('New description');
      });

      expect(
        document.querySelector('.inline-edit-container')
      ).not.toBeInTheDocument();
    });
  });

  describe('Rendering - Non-empty Description', () => {
    it('renders markdown previewer for non-empty description', () => {
      render(
        <DescriptionSection
          description="Some markdown text"
          onDescriptionUpdate={jest.fn()}
        />
      );

      expect(screen.getByTestId('markdown-parser')).toBeInTheDocument();
      expect(screen.getByText('Some markdown text')).toBeInTheDocument();

      // No show-more by default (no truncation simulated)
      expect(
        document.querySelector('.show-more-button')
      ).not.toBeInTheDocument();
    });

    it('allows entering edit mode from non-empty view and cancel back', () => {
      render(
        <DescriptionSection
          description="Content"
          onDescriptionUpdate={jest.fn()}
        />
      );

      const editTrigger = document.querySelector(
        '.description-header .cursor-pointer'
      ) as HTMLElement;
      fireEvent.click(editTrigger);

      expect(
        document.querySelector('.inline-edit-container')
      ).toBeInTheDocument();

      const cancel = document.querySelector(
        '.edit-actions .cursor-pointer'
      ) as HTMLElement;
      fireEvent.click(cancel);

      expect(
        document.querySelector('.inline-edit-container')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});
