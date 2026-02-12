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
import { EntityType } from '../../../enums/entity.enum';

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

jest.mock('../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">Edit</div>,
}));

// Mock ModalWithMarkdownEditor to a simple inline component for predictable DOM
jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => {
    return {
      ModalWithMarkdownEditor: ({
        visible,
        onCancel,
        onSave,
        header,
      }: {
        visible: boolean;
        onCancel: () => void;
        onSave?: (value: string) => void;
        header: string;
      }) => {
        if (!visible) {
          return null;
        }

        return (
          <div data-testid="markdown-editor">
            <div data-testid="header">{header}</div>
            <button data-testid="cancel" onClick={onCancel}>
              Cancel
            </button>
            <button
              data-testid="save"
              onClick={() => onSave?.('New description')}>
              Save
            </button>
          </div>
        );
      },
    };
  }
);

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
      const { container } = render(<DescriptionSection entityType={EntityType.LINEAGE_EDGE} />);

      expect(screen.getByText('label.description')).toBeInTheDocument();
      expect(
        screen.getByText(
          'label.no-entity-added - {"entity":"label.description-lowercase"}'
        )
      ).toBeInTheDocument();
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
      render(
        <DescriptionSection
          hasPermission
          showEditButton
          entityType={EntityType.LINEAGE_EDGE}
          onDescriptionUpdate={jest.fn()}
        />
      );

      const editIcon = screen.getByTestId('edit-icon-svg');

      expect(editIcon).toBeInTheDocument();
    });

    it('does not show edit control when showEditButton is false', () => {
      render(
        <DescriptionSection
          entityType={EntityType.LINEAGE_EDGE}
          showEditButton={false}
          onDescriptionUpdate={jest.fn()}
        />
      );

      const clickable = document.querySelector(
        '.description-header .edit-icon'
      ) as HTMLElement | null;

      expect(clickable).toBeNull();
    });

    it('does not show edit control when onDescriptionUpdate is not provided', () => {
      render(<DescriptionSection showEditButton entityType={EntityType.LINEAGE_EDGE} />);

      const clickable = document.querySelector(
        '.description-header .edit-icon'
      ) as HTMLElement | null;

      expect(clickable).toBeNull();
    });
  });

  describe('Edit Mode - Empty Description', () => {
    it('opens modal on edit and cancels back to view', () => {
      render(
        <DescriptionSection
          hasPermission
          showEditButton
          entityType={EntityType.LINEAGE_EDGE}
          onDescriptionUpdate={jest.fn()}
        />
      );

      const editTrigger = screen.getByTestId('edit-description');
      fireEvent.click(editTrigger);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('cancel');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument();
      expect(
        screen.getByText(
          'label.no-entity-added - {"entity":"label.description-lowercase"}'
        )
      ).toBeInTheDocument();
    });

    it('saves edited description and closes modal', async () => {
      const onUpdate = jest.fn().mockResolvedValue(undefined);

      render(
        <DescriptionSection
          hasPermission
          showEditButton
          entityType={EntityType.LINEAGE_EDGE}
          onDescriptionUpdate={onUpdate}
        />
      );

      const editTrigger = screen.getByTestId('edit-description');
      fireEvent.click(editTrigger);

      const saveBtn = screen.getByTestId('save');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith('New description');
      });

      expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument();
    });
  });

  describe('Rendering - Non-empty Description', () => {
    it('renders markdown previewer for non-empty description', () => {
      render(
        <DescriptionSection
          description="Some markdown text"
          entityType={EntityType.LINEAGE_EDGE}
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

    it('opens modal from non-empty view and cancel back', () => {
      render(
        <DescriptionSection
          hasPermission
          showEditButton
          description="Content"
          entityType={EntityType.LINEAGE_EDGE}
          onDescriptionUpdate={jest.fn()}
        />
      );

      const editTrigger = screen.getByTestId('edit-description');
      fireEvent.click(editTrigger);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('cancel');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});
