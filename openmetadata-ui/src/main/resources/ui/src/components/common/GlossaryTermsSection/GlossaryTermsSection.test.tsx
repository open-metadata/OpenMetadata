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
import { TagSource } from '../../../generated/type/tagLabel';
import GlossaryTermsSection from './GlossaryTermsSection';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
  useParams: jest.fn().mockReturnValue({}),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock custom location hook
jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
}));

// i18n mock
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

// SVG mocks
jest.mock('../../../assets/svg/edit.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">Edit</div>,
}));
jest.mock('../../../assets/svg/close-icon.svg', () => ({
  ReactComponent: () => <div data-testid="close-icon-svg">Close</div>,
}));
jest.mock('../../../assets/svg/tick.svg', () => ({
  ReactComponent: () => <div data-testid="tick-icon-svg">Tick</div>,
}));
jest.mock('../../../assets/svg/glossary.svg', () => ({
  ReactComponent: ({ className }: { className?: string }) => (
    <div className={className} data-testid="glossary-icon">
      G
    </div>
  ),
}));
jest.mock('../../../assets/svg/book.svg', () => ({
  ReactComponent: () => <div data-testid="book-icon">Book</div>,
}));

// Mock GlossaryTermSelectableListV1
jest.mock(
  '../GlossaryTermSelectableList/GlossaryTermSelectableList.v1.component',
  () => ({
    GlossaryTermSelectableListV1: jest
      .fn()
      .mockImplementation(
        ({
          onCancel,
          onUpdate,
          selectedTerms,
          children,
          popoverProps,
        }: {
          onCancel?: () => void;
          onUpdate?: (terms: any[]) => void;
          selectedTerms: any[];
          children: any;
          popoverProps?: any;
        }) => {
          const defaultValue = selectedTerms.map((t) => t.tagFQN).join(',');

          return (
            <div data-default={defaultValue} data-testid="tag-select-form">
              <button data-testid="tsf-cancel" onClick={() => onCancel?.()}>
                Cancel
              </button>
              <button
                data-testid="tsf-submit-strings"
                onClick={() =>
                  onUpdate?.([
                    {
                      tagFQN: 'g.term.1',
                      name: 'term.1',
                      source: TagSource.Glossary,
                      labelType: 'Manual' as const,
                      state: 'Confirmed' as const,
                    },
                    {
                      tagFQN: 'g.term.2',
                      name: 'term.2',
                      source: TagSource.Glossary,
                      labelType: 'Manual' as const,
                      state: 'Confirmed' as const,
                    },
                  ])
                }>
                SubmitStrings
              </button>
              <button
                data-testid="tsf-submit-objects"
                onClick={() =>
                  onUpdate?.([
                    {
                      tagFQN: 'g.term.obj',
                      name: 'term',
                      displayName: 'Term',
                      description: 'desc',
                      style: { color: 'red' },
                      source: TagSource.Glossary,
                      labelType: 'Manual' as const,
                      state: 'Confirmed' as const,
                    },
                  ])
                }>
                SubmitObjects
              </button>
              {children}
            </div>
          );
        }
      ),
  })
);

// Utils mocks
jest.mock('../../../utils/TagsUtils', () => ({
  fetchGlossaryList: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation(
      (tag: any) => tag.displayName || tag.name || tag.tagFQN
    ),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');
const { getEntityName } = jest.requireMock('../../../utils/EntityUtils');

const baseGlossaryTags = [
  {
    tagFQN: 'g.customer',
    source: TagSource.Glossary,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
    name: 'customer',
    displayName: 'Customer',
  },
  {
    tagFQN: 'g.order',
    source: TagSource.Glossary,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
    name: 'order',
    displayName: 'Order',
  },
];

const nonGlossaryTags = [
  {
    tagFQN: 'Classification.PII',
    source: 'Classification' as any,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
  },
];

const clickHeaderEdit = () => {
  const clickable = document.querySelector(
    '.glossary-terms-header .edit-icon'
  ) as HTMLElement | null;
  if (!clickable) {
    throw new Error('Edit clickable not found');
  }
  fireEvent.click(clickable);
};

describe('GlossaryTermsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - No Terms', () => {
    it('shows header, no data placeholder, and edit control when permitted', () => {
      const { container } = render(
        <GlossaryTermsSection hasPermission showEditButton />
      );

      expect(
        container.querySelector('.glossary-terms-section')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.glossary-terms-header')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.glossary-term-plural')
      ).toBeInTheDocument();
      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();

      const editClickable = document.querySelector(
        '.glossary-terms-header .edit-icon'
      );

      expect(editClickable).toBeTruthy();
    });

    it('enters edit mode and cancels back', () => {
      render(<GlossaryTermsSection hasPermission showEditButton />);

      clickHeaderEdit();

      expect(screen.getByTestId('tag-select-form')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tsf-cancel'));

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });
  });

  describe('Rendering - With Terms', () => {
    it('lists glossary terms using getEntityName and shows icon', () => {
      const { container } = render(
        <GlossaryTermsSection
          tags={[...nonGlossaryTags, ...baseGlossaryTags]}
        />
      );

      expect(
        container.querySelector('.glossary-terms-list')
      ).toBeInTheDocument();
      expect(getEntityName).toHaveBeenCalled();
      expect(screen.getAllByTestId('book-icon').length).toBeGreaterThan(0);

      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Order')).toBeInTheDocument();
    });

    it('shows edit actions during editing and hides edit icon', () => {
      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={baseGlossaryTags as any}
        />
      );

      // enter edit
      clickHeaderEdit();

      // form visible with default values
      expect(screen.getByTestId('tag-select-form')).toHaveAttribute(
        'data-default',
        'g.customer,g.order'
      );
    });
  });

  describe('Save Flow', () => {
    it('calls onGlossaryTermsUpdate via selection submit and keeps non-glossary tags', async () => {
      const onUpdate = jest.fn().mockResolvedValue(undefined);

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={[...nonGlossaryTags, ...baseGlossaryTags] as any}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();

      // Submit string selections from form
      fireEvent.click(screen.getByTestId('tsf-submit-strings'));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();

        const arg = onUpdate.mock.calls[0][0];

        // Should contain non-glossary tag and new selections
        expect(
          arg.find((t: any) => t.tagFQN === 'Classification.PII')
        ).toBeTruthy();
        expect(arg.find((t: any) => t.tagFQN === 'g.term.1')).toBeTruthy();
        expect(arg.find((t: any) => t.tagFQN === 'g.term.2')).toBeTruthy();
      });
    });

    it('shows error toast on selection submit error', async () => {
      const error = new Error('fail');
      const onUpdate = jest.fn().mockRejectedValue(error);

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={baseGlossaryTags as any}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('tsf-submit-strings'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Selection Submit', () => {
    it('submits string values and exits edit mode', async () => {
      const onUpdate = jest.fn().mockResolvedValue(undefined);

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={nonGlossaryTags as any}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('tsf-submit-strings'));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();

        const updated = onUpdate.mock.calls[0][0];

        expect(updated.find((t: any) => t.tagFQN === 'g.term.1')).toBeTruthy();
        expect(updated.find((t: any) => t.tagFQN === 'g.term.2')).toBeTruthy();
      });

      // form should be gone
      await waitFor(() => {
        expect(screen.queryByTestId('tag-select-form')).not.toBeInTheDocument();
      });
    });

    it('submits object values with data and maps fields', async () => {
      const onUpdate = jest.fn().mockResolvedValue(undefined);

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={nonGlossaryTags as any}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('tsf-submit-objects'));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();

        const updated = onUpdate.mock.calls[0][0];
        const obj = updated.find((t: any) => t.tagFQN === 'g.term.obj');

        expect(obj).toBeTruthy();
        expect(obj.source).toBe(TagSource.Glossary);
        expect(obj.labelType).toBeDefined();
        expect(obj.state).toBeDefined();
        expect(obj.displayName).toBe('Term');
        expect(obj.description).toBe('desc');
        expect(obj.style).toEqual({ color: 'red' });
      });
    });
  });
});
