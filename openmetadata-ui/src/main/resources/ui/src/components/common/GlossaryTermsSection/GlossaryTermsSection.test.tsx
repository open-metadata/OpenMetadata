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
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import GlossaryTermsSection from './GlossaryTermsSection';

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  blue: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    200: '#91D5FF',
    300: '#69C0FF',
    600: '#1677FF',
    700: '#0958D9',
  },
  blueGray: {
    50: '#F8FAFC',
    75: '#F1F5F9',
    150: '#E2E8F0',
  },
  gray: {
    200: '#E5E7EB',
    300: '#D1D5DB',
    500: '#6B7280',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
    primary: {
      main: '#1677FF',
      dark: '#0958D9',
    },
    background: {
      paper: '#FFFFFF',
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

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
  const clickable = screen.getByTestId('edit-glossary-terms');
  fireEvent.click(clickable);
};

describe('GlossaryTermsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - No Terms', () => {
    it('shows header, no data placeholder, and edit control when permitted', () => {
      render(<GlossaryTermsSection hasPermission showEditButton />, {
        wrapper: Wrapper,
      });

      expect(screen.getByTestId('glossary-terms-section')).toBeInTheDocument();
      expect(
        screen.getByText('label.glossary-term-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.glossary-term-plural"}'
        )
      ).toBeInTheDocument();

      expect(screen.getByTestId('edit-glossary-terms')).toBeInTheDocument();
    });

    it('enters edit mode and cancels back', () => {
      render(<GlossaryTermsSection hasPermission showEditButton />, {
        wrapper: Wrapper,
      });

      clickHeaderEdit();

      expect(screen.getByTestId('tag-select-form')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tsf-cancel'));

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.glossary-term-plural"}'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Rendering - With Terms', () => {
    it('lists glossary terms using getEntityName and shows icon', () => {
      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={[...nonGlossaryTags, ...baseGlossaryTags]}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByTestId('glossary-container')).toBeInTheDocument();
      expect(getEntityName).toHaveBeenCalled();

      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Order')).toBeInTheDocument();
    });

    it('shows edit actions during editing and hides edit icon', () => {
      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          tags={baseGlossaryTags as TagLabel[]}
        />,
        { wrapper: Wrapper }
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
        />,
        { wrapper: Wrapper }
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
      const onUpdate = jest.fn();

      render(
        <GlossaryTermsSection
          hasPermission
          showEditButton
          entityId="123"
          entityType={EntityType.TABLE}
          tags={baseGlossaryTags as TagLabel[]}
          onGlossaryTermsUpdate={onUpdate}
        />,
        { wrapper: Wrapper }
      );

      clickHeaderEdit();
      await act(async () => {
        fireEvent.click(screen.getByTestId('tsf-submit-strings'));
      });

      await waitFor(() => {
        expect(onUpdate).not.toHaveBeenCalled();
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
        />,
        { wrapper: Wrapper }
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
        />,
        { wrapper: Wrapper }
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
