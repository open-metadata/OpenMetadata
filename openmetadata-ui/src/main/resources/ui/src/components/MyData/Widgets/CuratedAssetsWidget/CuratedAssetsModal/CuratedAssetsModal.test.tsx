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
import { FormEvent, ReactNode } from 'react';
import { FormProvider, useFormContext } from 'react-hook-form';
import { EntityType } from '../../../../../enums/entity.enum';
import CuratedAssetsModal from './CuratedAssetsModal';
import { CuratedAssetsConfig } from './CuratedAssetsModal.interface';

const VALID_QUERY = JSON.stringify({
  query: {
    bool: { must: [{ bool: { must: [{ term: { deleted: false } }] } }] },
  },
});

// The app and the linked core package each resolve their own react-hook-form
// under jest (Vite dedupes them in the real build), so the form provider comes
// from the app copy here.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  HookForm: ({
    children,
    form,
    onSubmit,
    ...props
  }: {
    children: ReactNode;
    form: ReturnType<typeof import('react-hook-form').useForm>;
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
    [key: string]: unknown;
  }) => (
    <FormProvider {...form}>
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}>
        {children}
      </form>
    </FormProvider>
  ),
}));

jest.mock(
  '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockReturnValue({
      config: {},
      onChangeSearchIndex: jest.fn(),
    }),
  })
);

jest.mock('../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn().mockReturnValue({}),
    getEntityIconWithBg: jest.fn().mockReturnValue(null),
  },
}));

// The query builder has its own suite; this stand-in writes the query filter
// the way the real field does.
jest.mock(
  '../AdvancedAssetsFilterField/AdvancedAssetsFilterField.component',
  () => ({
    AdvancedAssetsFilterField: () => {
      const { setValue } = useFormContext<CuratedAssetsConfig>();

      return (
        <div data-testid="advanced-assets-filter-field">
          <button onClick={() => setValue('queryFilter', VALID_QUERY)}>
            set-valid-query
          </button>
          <button onClick={() => setValue('queryFilter', '{}')}>
            set-empty-query
          </button>
        </div>
      );
    },
  })
);

jest.mock('../../../../../utils/CuratedAssetsUtils', () => ({
  getSelectedResourceCount: jest.fn().mockResolvedValue({
    entityCount: 10,
    resourcesWithNonZeroCount: [],
  }),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const renderModal = (
  curatedAssetsConfig: CuratedAssetsConfig | null = null,
  isOpen = true
) =>
  render(
    <CuratedAssetsModal
      curatedAssetsConfig={curatedAssetsConfig}
      isOpen={isOpen}
      onCancel={mockOnCancel}
      onSave={mockOnSave}
    />
  );

const pickAssetType = async (id: string) => {
  fireEvent.click(screen.getByTestId('asset-type-select'));
  const node = await screen.findByTestId(`tree-node-${id}`);
  await act(async () => {
    fireEvent.click(node);
  });
};

describe('CuratedAssetsModal', () => {
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {
        return;
      }

      unobserve() {
        return;
      }

      disconnect() {
        return;
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the create title and an empty form with Save disabled', () => {
    renderModal();

    expect(
      screen.getByRole('dialog', { name: 'label.create-widget' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('curated-assets-form')).toBeInTheDocument();
    expect(screen.getByTestId('title-input')).toHaveValue('');
    expect(screen.getByTestId('saveButton')).toBeDisabled();
  });

  it('saves the title, asset type and query filter the user entered', async () => {
    renderModal();

    fireEvent.change(screen.getByTestId('title-input'), {
      target: { value: 'My Tables' },
    });
    await pickAssetType(EntityType.TABLE);
    fireEvent.click(screen.getByText('set-valid-query'));

    const saveButton = screen.getByTestId('saveButton');

    expect(saveButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnSave).toHaveBeenCalledWith({
      title: 'My Tables',
      resources: [EntityType.TABLE],
      queryFilter: VALID_QUERY,
    });
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('prefills the form in edit mode and saves it unchanged', async () => {
    const config = {
      title: 'Existing Widget',
      resources: [EntityType.DASHBOARD],
      queryFilter: VALID_QUERY,
    };
    renderModal(config);

    expect(
      screen.getByRole('dialog', { name: 'label.edit-widget' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('title-input')).toHaveValue('Existing Widget');

    await act(async () => {
      fireEvent.click(screen.getByTestId('saveButton'));
    });

    expect(mockOnSave).toHaveBeenCalledWith(config);
  });

  it.each([
    ['the title is empty', { title: '' }],
    ['no asset type is selected', { resources: [] }],
  ])('keeps Save disabled when %s', (_, override) => {
    renderModal({
      title: 'Widget',
      resources: [EntityType.TABLE],
      queryFilter: VALID_QUERY,
      ...override,
    });

    expect(screen.getByTestId('saveButton')).toBeDisabled();
  });

  it('disables Save when the query filter is not a valid query', () => {
    renderModal({
      title: 'Widget',
      resources: [EntityType.TABLE],
      queryFilter: VALID_QUERY,
    });

    expect(screen.getByTestId('saveButton')).toBeEnabled();

    fireEvent.click(screen.getByText('set-empty-query'));

    expect(screen.getByTestId('saveButton')).toBeDisabled();
  });

  it('calls onCancel without saving when Cancel is clicked', () => {
    renderModal();

    fireEvent.click(screen.getByTestId('cancelButton'));

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('does not render the modal when closed', () => {
    renderModal(null, false);

    expect(
      screen.queryByTestId('curated-assets-modal-container')
    ).not.toBeInTheDocument();
  });
});
