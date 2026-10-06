/*
 *  Copyright 2026 Collate.
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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/ontologyAPI', () => ({
  createRelationshipType: jest.fn(),
  getRelationshipTypeByName: jest.fn(),
  updateRelationshipType: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeForm',
  () =>
    jest.fn(
      ({
        values,
        onChange,
        isEditing,
      }: {
        values: { name: string; displayName: string };
        onChange: (v: Record<string, unknown>) => void;
        isEditing: boolean;
      }) => (
        <div data-testid="relation-type-form">
          <input
            aria-label="name"
            data-testid="name-input"
            disabled={isEditing}
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
          />
          <input
            aria-label="displayName"
            data-testid="display-name-input"
            value={values.displayName}
            onChange={(e) =>
              onChange({ ...values, displayName: e.target.value })
            }
          />
        </div>
      )
    )
);

jest.mock(
  '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeForm.utils',
  () => ({
    DEFAULT_RELATIONSHIP_TYPE_FORM: {
      name: '',
      displayName: '',
      description: '',
      rdfPredicate: '',
      cardinalityPreset: 'MANY_TO_MANY',
      category: 'CUSTOM',
      paletteKey: 'VIOLET',
      characteristics: [],
      crossGlossaryAllowed: true,
    },
    toRelationshipTypeForm: jest.fn((rt) => ({
      name: rt.name,
      displayName: rt.displayName ?? '',
      description: '',
      rdfPredicate: '',
      cardinalityPreset: 'MANY_TO_MANY',
      category: 'CUSTOM',
      paletteKey: 'VIOLET',
      characteristics: [],
      crossGlossaryAllowed: true,
    })),
    toRelationshipTypeRequest: jest.fn((form) => form),
  })
);

jest.mock(
  '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeForm.validation',
  () => ({
    validateRelationshipTypeForm: jest.fn().mockReturnValue({}),
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    'data-testid': testId,
    isDisabled,
    isLoading,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
    isDisabled?: boolean;
    isLoading?: boolean;
  }) => (
    <button
      data-loading={isLoading}
      data-testid={testId}
      disabled={isDisabled}
      onClick={onPress}>
      {children}
    </button>
  ),
}));

import {
  createRelationshipType,
  getRelationshipTypeByName,
  updateRelationshipType,
} from '../../../../../../rest/ontologyAPI';
import GovernanceGlossaryFormPage from './GovernanceGlossaryFormPage';

const mockCreate = createRelationshipType as jest.Mock;
const mockGetByName = getRelationshipTypeByName as jest.Mock;
const mockUpdate = updateRelationshipType as jest.Mock;

const mockOnNavigate = jest.fn();

const existingRelationshipType = {
  id: 'rt-1',
  name: 'broader',
  displayName: 'Broader',
  category: 'CORE',
  rdfPredicate: '',
  characteristics: [],
  crossGlossaryAllowed: true,
  paletteKey: 'BLUE',
};

const renderAdd = () =>
  render(
    <MemoryRouter>
      <GovernanceGlossaryFormPage onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

const renderEdit = () =>
  render(
    <MemoryRouter>
      <GovernanceGlossaryFormPage
        editName="broader"
        onNavigate={mockOnNavigate}
      />
    </MemoryRouter>
  );

describe('GovernanceGlossaryFormPage — add mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'new-1', name: 'test' });
  });

  it('renders the form', () => {
    renderAdd();

    expect(screen.getByTestId('glossary-form-page')).toBeInTheDocument();
    expect(screen.getByTestId('relation-type-form')).toBeInTheDocument();
  });

  it('renders save and cancel buttons', () => {
    renderAdd();

    expect(screen.getByTestId('glossary-form-save')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-form-cancel')).toBeInTheDocument();
  });

  it('navigates to glossary-list on cancel', () => {
    renderAdd();
    fireEvent.click(screen.getByTestId('glossary-form-cancel'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'glossary-list' });
  });

  it('calls createRelationshipType and navigates on save', async () => {
    renderAdd();
    await act(async () => {
      fireEvent.click(screen.getByTestId('glossary-form-save'));
    });

    expect(mockCreate).toHaveBeenCalled();
    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'glossary-list' });
  });

  it('does not call updateRelationshipType in add mode', async () => {
    renderAdd();
    await act(async () => {
      fireEvent.click(screen.getByTestId('glossary-form-save'));
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('GovernanceGlossaryFormPage — edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByName.mockResolvedValue(existingRelationshipType);
    mockUpdate.mockResolvedValue(existingRelationshipType);
  });

  it('shows loading while fetching the existing item', () => {
    mockGetByName.mockReturnValue(new Promise(() => {}));
    renderEdit();

    expect(screen.getByText('label.loading')).toBeInTheDocument();
  });

  const renderEditAndWait = async () => {
    renderEdit();
    await act(async () => {});
  };

  it('renders the form after loading with name disabled', async () => {
    await renderEditAndWait();

    expect(screen.getByTestId('relation-type-form')).toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toBeDisabled();
  });

  it('calls updateRelationshipType and navigates on save', async () => {
    await renderEditAndWait();
    await act(async () => {
      fireEvent.click(screen.getByTestId('glossary-form-save'));
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'glossary-list' });
  });

  it('does not call createRelationshipType in edit mode', async () => {
    await renderEditAndWait();
    await act(async () => {
      fireEvent.click(screen.getByTestId('glossary-form-save'));
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
