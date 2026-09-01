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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { getRelationTypeUsageCounts } from '../../rest/glossaryAPI';
import {
  createRelationshipType,
  deleteRelationshipType,
  listRelationshipTypes,
  updateRelationshipType,
} from '../../rest/ontologyAPI';
import GlossaryTermRelationSettingsPage from './GlossaryTermRelationSettings';
import { RelationshipTypeFormValues } from './RelationshipTypeForm.utils';

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div data-testid="breadcrumbs" />)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }) => <div>{children}</div>)
);

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => ({ isAdminUser: true })),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn(() => []),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  getRelationTypeUsageCounts: jest.fn(),
}));

jest.mock('../../rest/ontologyAPI', () => ({
  createRelationshipType: jest.fn(),
  deleteRelationshipType: jest.fn(),
  listRelationshipTypes: jest.fn(),
  updateRelationshipType: jest.fn(),
}));

jest.mock('./RelationshipTypeTable', () =>
  jest.fn(
    ({
      relationshipTypes,
      onDelete,
      onEdit,
    }: {
      relationshipTypes: RelationshipType[];
      onDelete: (relationshipType: RelationshipType) => void;
      onEdit: (relationshipType: RelationshipType) => void;
    }) => (
      <div data-testid="relationship-type-table">
        {relationshipTypes.map((relationshipType) => (
          <div key={relationshipType.id}>
            <span>{relationshipType.name}</span>
            <span>{relationshipType.displayName}</span>
            <button
              data-testid={`mock-edit-${relationshipType.name}`}
              onClick={() => onEdit(relationshipType)}>
              edit
            </button>
            <button
              data-testid={`mock-delete-${relationshipType.name}`}
              onClick={() => onDelete(relationshipType)}>
              delete
            </button>
          </div>
        ))}
      </div>
    )
  )
);

jest.mock('./RelationshipTypeForm', () =>
  jest.fn(
    ({
      values,
      onChange,
    }: {
      values: RelationshipTypeFormValues;
      onChange: (values: RelationshipTypeFormValues) => void;
    }) => (
      <button
        data-testid="fill-valid-form"
        onClick={() =>
          onChange({
            ...values,
            displayName: values.displayName || 'Governed By',
            name: values.name || 'governedBy',
            rdfPredicate:
              values.rdfPredicate || 'https://example.org/governedBy',
          })
        }>
        fill
      </button>
    )
  )
);

const mockCreateRelationshipType =
  createRelationshipType as jest.MockedFunction<typeof createRelationshipType>;
const mockDeleteRelationshipType =
  deleteRelationshipType as jest.MockedFunction<typeof deleteRelationshipType>;
const mockGetRelationTypeUsageCounts =
  getRelationTypeUsageCounts as jest.MockedFunction<
    typeof getRelationTypeUsageCounts
  >;
const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;
const mockUpdateRelationshipType =
  updateRelationshipType as jest.MockedFunction<typeof updateRelationshipType>;

const EXISTING_TYPE = createRelationshipTypeMock({
  id: 'existing-id',
  name: 'governedBy',
  systemDefined: false,
});

describe('GlossaryTermRelationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRelationTypeUsageCounts.mockResolvedValue({});
    mockListRelationshipTypes.mockResolvedValue({
      data: [EXISTING_TYPE],
      paging: { total: 1 },
    });
  });

  it('loads first-class relationship types and creates a valid type', async () => {
    const created = createRelationshipTypeMock({
      id: 'created-id',
      name: 'supersedes',
      systemDefined: false,
    });
    mockCreateRelationshipType.mockResolvedValue(created);
    render(<GlossaryTermRelationSettingsPage />);

    await screen.findByTestId('relationship-type-table');
    fireEvent.click(screen.getByTestId('add-relation-type-btn'));
    fireEvent.click(screen.getByTestId('fill-valid-form'));
    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() => expect(mockCreateRelationshipType).toHaveBeenCalled());

    expect(mockListRelationshipTypes).toHaveBeenCalledWith({
      fields: 'owners,reviewers',
      limit: 1000,
    });
    expect(
      await screen.findByTestId(`mock-edit-${created.name}`)
    ).toBeInTheDocument();
  });

  it('updates an existing first-class relationship type', async () => {
    const updated = createRelationshipTypeMock({
      ...EXISTING_TYPE,
      displayName: 'Governed by policy',
    });
    mockUpdateRelationshipType.mockResolvedValue(updated);
    render(<GlossaryTermRelationSettingsPage />);

    fireEvent.click(await screen.findByTestId('mock-edit-governedBy'));
    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() => expect(mockUpdateRelationshipType).toHaveBeenCalled());

    expect(await screen.findByText(updated.displayName)).toBeInTheDocument();
  });

  it('deletes the selected first-class relationship type after confirmation', async () => {
    mockDeleteRelationshipType.mockResolvedValue(undefined);
    render(<GlossaryTermRelationSettingsPage />);

    fireEvent.click(await screen.findByTestId('mock-delete-governedBy'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() =>
      expect(mockDeleteRelationshipType).toHaveBeenCalledWith(EXISTING_TYPE.id)
    );

    expect(screen.queryByText(EXISTING_TYPE.name)).not.toBeInTheDocument();
  });

  it('paginates first-class relationship types', async () => {
    const relationshipTypes = Array.from(
      { length: PAGE_SIZE_BASE + 1 },
      (_, index) =>
        createRelationshipTypeMock({
          id: `relationship-type-${index}`,
          name: `relationshipType${String(index).padStart(2, '0')}`,
        })
    );
    mockListRelationshipTypes.mockResolvedValue({
      data: relationshipTypes,
      paging: { total: relationshipTypes.length },
    });

    render(<GlossaryTermRelationSettingsPage />);

    await screen.findByTestId('relationship-type-table');

    expect(screen.getAllByTestId(/^mock-edit-/)).toHaveLength(PAGE_SIZE_BASE);

    fireEvent.click(screen.getByRole('button', { name: 'Next Page' }));

    expect(
      await screen.findByTestId(
        `mock-edit-${relationshipTypes[PAGE_SIZE_BASE].name}`
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(relationshipTypes[0].name)
    ).not.toBeInTheDocument();
  });
});
