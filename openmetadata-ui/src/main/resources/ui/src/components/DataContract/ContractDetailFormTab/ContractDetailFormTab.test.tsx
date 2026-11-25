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
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  DataContract,
  EntityStatus,
} from '../../../generated/entity/data/dataContract';
import { EntityReference } from '../../../generated/entity/type';
import { ContractDetailFormTab } from './ContractDetailFormTab';

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.contract-title': 'Contract Title',
        'label.owner-plural': 'Owners',
        'label.status': 'Status',
        'label.draft': 'Draft label',
        'label.in-review': 'In Review label',
        'label.approved': 'Approved label',
        'label.description': 'Description',
        'label.contract-detail-plural': 'Contract Details',
        'message.contract-detail-plural-description': 'Enter contract details',
        'label.next': 'Next',
      };

      return translations[key] || key;
    },
  }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

const mockOwnersPicker = {
  options: [],
  onFocus: jest.fn(),
  onSearchChange: jest.fn(),
};

jest.mock('../../Glossary/hooks/useEntityReferenceOptions', () => ({
  useUserTeamOptions: () => mockOwnersPicker,
}));

// A plain function, not jest.fn: clearMocks would strip a mocked implementation.
jest.mock(
  '../../common/RichTextEditor/RichTextEditor',
  () =>
    function MockRichTextEditor({
      initialValue,
      onTextChange,
    }: {
      initialValue?: string;
      onTextChange?: (value: string) => void;
    }) {
      return (
        <textarea
          aria-label="Description editor"
          data-testid="description-editor"
          defaultValue={initialValue}
          onChange={(e) => onTextChange?.(e.target.value)}
        />
      );
    }
);

const mockOnNext = jest.fn();
const mockOnChange = jest.fn();

const mockInitialValues: Partial<DataContract> = {
  name: 'Test Contract',
  description: 'Test Description',
  entityStatus: EntityStatus.InReview,
  owners: [
    { id: 'user-1', name: 'Test User', type: 'user' },
  ] as EntityReference[],
};

const renderForm = (
  props: Partial<Parameters<typeof ContractDetailFormTab>[0]> = {}
) =>
  render(
    <ContractDetailFormTab
      buttonProps={{ nextLabel: 'Custom Next', isNextVisible: true }}
      onChange={mockOnChange}
      onNext={mockOnNext}
      {...props}
    />
  );

describe('ContractDetailFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the step header and every field', () => {
    renderForm();

    expect(screen.getByText('Contract Details')).toBeInTheDocument();
    expect(screen.getByText('Enter contract details')).toBeInTheDocument();
    expect(screen.getByText('Contract Title')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Owners')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('prefills the fields from the initial values', () => {
    renderForm({ initialValues: mockInitialValues });

    expect(screen.getByRole('textbox', { name: 'Contract Title' })).toHaveValue(
      'Test Contract'
    );
    expect(screen.getAllByText('In Review label').length).toBeGreaterThan(0);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByTestId('description-editor')).toHaveValue(
      'Test Description'
    );
  });

  it('defaults the status to draft', () => {
    renderForm();

    expect(screen.getAllByText('Draft label').length).toBeGreaterThan(0);
  });

  // Seeding the form must not report changes, or saving an untouched title would
  // overwrite a divergent displayName (see AddDataContract/DisplayNameOverwriteBug).
  it('does not report changes when it seeds the form', () => {
    renderForm({ initialValues: mockInitialValues });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('reports only the edited title', () => {
    renderForm({ initialValues: mockInitialValues });

    fireEvent.change(screen.getByRole('textbox', { name: 'Contract Title' }), {
      target: { value: 'Renamed' },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith({ name: 'Renamed' });
  });

  // userEvent hangs on react-aria buttons in this suite, so drive it with fireEvent.
  it('reports the selected status as an entity status', async () => {
    renderForm({ initialValues: mockInitialValues });

    fireEvent.click(screen.getByRole('button', { name: /Status/ }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Approved label' })
    );

    expect(mockOnChange).toHaveBeenLastCalledWith({
      entityStatus: EntityStatus.Approved,
    });
  });

  it('reports the edited description', () => {
    renderForm({ initialValues: mockInitialValues });

    fireEvent.change(screen.getByTestId('description-editor'), {
      target: { value: 'New description' },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      description: 'New description',
    });
  });

  it('shows the next button with its label and moves on', () => {
    renderForm();

    const nextButton = screen.getByRole('button', { name: 'Custom Next' });
    fireEvent.click(nextButton);

    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it('hides the next button on the last step', () => {
    renderForm({ buttonProps: { isNextVisible: false } });

    expect(
      screen.queryByRole('button', { name: /Next/ })
    ).not.toBeInTheDocument();
  });
});
