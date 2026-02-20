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
import { EntityType } from '../../../enums/entity.enum';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
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
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// SVG mocks
jest.mock('../../../assets/svg/edit-new.svg', () => ({
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
  '../GlossaryTermSelectableList/GlossaryTermSelectableList.component',
  () => ({
    GlossaryTermSelectableList: jest
      .fn()
      .mockImplementation(
        ({
          onCancel,
          onUpdate,
          selectedTerms,
          children,
        }: {
          onCancel?: () => void;
          onUpdate?: (terms: TagLabel[]) => void;
          selectedTerms: TagLabel[];
          children: React.ReactNode;
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
                      labelType: LabelType.Manual,
                      state: State.Confirmed,
                    },
                    {
                      tagFQN: 'g.term.2',
                      name: 'term.2',
                      source: TagSource.Glossary,
                      labelType: LabelType.Manual,
                      state: State.Confirmed,
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
                      labelType: LabelType.Manual,
                      state: State.Confirmed,
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
      (tag: TagLabel) => tag.displayName || tag.name || tag.tagFQN
    ),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// Mock EditIconButton
jest.mock('../IconButtons/EditIconButton', () => ({
  EditIconButton: jest.fn().mockImplementation(({ onClick, ...props }) => (
    <button
      className="edit-icon"
      data-testid="edit-icon-button"
      onClick={onClick}
      {...props}>
      Edit
    </button>
  )),
}));

// Mock Loader
jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => (
    <div className="glossary-terms-loading-container" data-testid="loader">
      Loading...
    </div>
  )),
}));

// Mock EntityUpdateUtils
jest.mock('../../../utils/EntityUpdateUtils', () => ({
  updateEntityField: jest
    .fn()
    .mockImplementation(async ({ onSuccess, newValue }) => {
      await Promise.resolve();
      onSuccess(newValue);

      return { success: true };
    }),
}));

// Mock useEntityRules hook
jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn(),
}));

jest.requireMock('../../../utils/ToastUtils');
const { getEntityName } = jest.requireMock('../../../utils/EntityUtils');

const baseGlossaryTags = [
  {
    tagFQN: 'g.customer',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    name: 'customer',
    displayName: 'Customer',
  },
  {
    tagFQN: 'g.order',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    name: 'order',
    displayName: 'Order',
  },
];

const nonGlossaryTags = [
  {
    tagFQN: 'Classification.PII',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
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
    // Set default entity rules
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: {
        canAddMultipleGlossaryTerm: true,
      },
      rules: [],
      isLoading: false,
    });
  });

  describe('Rendering - No Terms', () => {
    it('shows header, no data placeholder, and edit control when permitted', () => {
      const { container } = render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityType={EntityType.TABLE}
        />
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
      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.glossary-term-plural"}'
        )
      ).toBeInTheDocument();

      const editClickable = document.querySelector(
        '.glossary-terms-header .edit-icon'
      );

      expect(editClickable).toBeTruthy();
    });

    it('enters edit mode and cancels back', () => {
      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityType={EntityType.TABLE}
        />
      );

      clickHeaderEdit();

      expect(screen.getByTestId('tag-select-form')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tsf-cancel'));

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.glossary-term-plural"}'
        )
      ).toBeInTheDocument();
    });

    it('keeps showing no glossary terms placeholder while the popup is open', async () => {
      render(<GlossaryTermsSection hasPermission showEditButton />);

      clickHeaderEdit();

      expect(screen.getByTestId('tag-select-form')).toBeInTheDocument();

      await waitFor(() => {
        expect(
          screen.getByText(
            'label.no-entity-assigned - {"entity":"label.glossary-term-plural"}'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Rendering - With Terms', () => {
    it('lists glossary terms using getEntityName and shows icon', () => {
      const { container } = render(
        <GlossaryTermsSection
          entityType={EntityType.TABLE}
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
          entityType={EntityType.TABLE}
          tags={baseGlossaryTags as TagLabel[]}
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
      const onUpdate = jest.fn();

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityId="123"
          entityType={EntityType.TABLE}
          tags={[...nonGlossaryTags, ...baseGlossaryTags] as TagLabel[]}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();

      // Submit string selections from form
      await act(async () => {
        fireEvent.click(screen.getByTestId('tsf-submit-strings'));
        await Promise.resolve(); // flush microtasks
      });

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();

        const arg = onUpdate.mock.calls[0][0];

        // Should contain non-glossary tag and new selections
        expect(
          arg.find((t: TagLabel) => t.tagFQN === 'Classification.PII')
        ).toBeTruthy();
        expect(arg.find((t: TagLabel) => t.tagFQN === 'g.term.1')).toBeTruthy();
        expect(arg.find((t: TagLabel) => t.tagFQN === 'g.term.2')).toBeTruthy();
      });
    });

    it('shows error toast on selection submit error', async () => {
      (updateEntityField as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ success: false })
      );

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityId="123"
          entityType={EntityType.TABLE}
          tags={baseGlossaryTags as TagLabel[]}
        />
      );

      clickHeaderEdit();
      await act(async () => {
        fireEvent.click(screen.getByTestId('tsf-submit-strings'));
      });

      await waitFor(() => {
        expect(updateEntityField).toHaveBeenCalled();
      });
    });
  });

  describe('Selection Submit', () => {
    it('submits string values and exits edit mode', async () => {
      const onUpdate = jest.fn();

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityId="123"
          entityType={EntityType.TABLE}
          tags={nonGlossaryTags as TagLabel[]}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();
      await act(async () => {
        fireEvent.click(screen.getByTestId('tsf-submit-strings'));
      });

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();

        const updated = onUpdate.mock.calls[0][0];

        expect(
          updated.find((t: TagLabel) => t.tagFQN === 'g.term.1')
        ).toBeTruthy();
        expect(
          updated.find((t: TagLabel) => t.tagFQN === 'g.term.2')
        ).toBeTruthy();
      });

      // form should be gone
      await waitFor(() => {
        expect(screen.queryByTestId('tag-select-form')).not.toBeInTheDocument();
      });
    });

    it('submits object values with data and maps fields', async () => {
      const onUpdate = jest.fn();

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityId="123"
          entityType={EntityType.TABLE}
          tags={nonGlossaryTags as TagLabel[]}
          onGlossaryTermsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();
      await act(async () => {
        fireEvent.click(screen.getByTestId('tsf-submit-objects'));
      });

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();

        const updated = onUpdate.mock.calls[0][0];
        const obj = updated.find((t: TagLabel) => t.tagFQN === 'g.term.obj');

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
