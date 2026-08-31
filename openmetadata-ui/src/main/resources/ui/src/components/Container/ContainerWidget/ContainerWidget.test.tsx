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

import { render, screen } from '@testing-library/react';
import { Container } from '../../../generated/entity/data/container';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { ContainerWidget } from './ContainerWidget';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testContainerFqn' })),
}));

jest.mock('../ContainerChildren/ContainerChildren', () =>
  jest.fn().mockImplementation(() => <div>ContainerChildren</div>)
);

jest.mock('../ContainerDataModel/ContainerDataModel', () =>
  jest.fn().mockImplementation((props) => (
    <div>
      ContainerDataModel
      <span data-testid="description-edit-access">
        {String(props.hasDescriptionEditAccess)}
      </span>
      <span data-testid="glossary-edit-access">
        {String(props.hasGlossaryTermEditAccess)}
      </span>
      <span data-testid="tag-edit-access">
        {String(props.hasTagEditAccess)}
      </span>
      <span data-testid="is-read-only">{String(props.isReadOnly)}</span>
    </div>
  ))
);

const mockUseGenericContextResult = {
  data: {} as Container,
  permissions: {} as OperationPermission,
  onUpdate: jest.fn(),
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => mockUseGenericContextResult),
}));

const mockContainerWithDataModel: Container = {
  id: 'container-id',
  name: 'test-container',
  fullyQualifiedName: 'test-service.test-container',
  dataModel: {
    columns: [
      {
        name: 'col1',
        dataType: 'STRING',
        fullyQualifiedName: 'test-service.test-container.col1',
      },
    ],
  },
  deleted: false,
} as unknown as Container;

describe('ContainerWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenericContextResult.data = mockContainerWithDataModel;
    mockUseGenericContextResult.permissions = ENTITY_PERMISSIONS;
  });

  it('renders ContainerChildren when dataModel is empty', async () => {
    mockUseGenericContextResult.data = {
      ...mockContainerWithDataModel,
      dataModel: undefined,
    };

    render(<ContainerWidget />);

    expect(await screen.findByText('ContainerChildren')).toBeInTheDocument();
  });

  it('renders ContainerDataModel when dataModel is present', async () => {
    render(<ContainerWidget />);

    expect(await screen.findByText('ContainerDataModel')).toBeInTheDocument();
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 10): an
  // explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins, Task 6
  // Finding 1) — the old raw `EditX || EditAll` OR let EditAll grant unconditionally.
  it('denies description edit when EditDescription is explicitly false, even with EditAll true', async () => {
    mockUseGenericContextResult.permissions = {
      ...ENTITY_PERMISSIONS,
      EditDescription: false,
    } as OperationPermission;

    render(<ContainerWidget />);

    expect(
      await screen.findByTestId('description-edit-access')
    ).toHaveTextContent('false');
  });

  it('denies glossary term edit when EditGlossaryTerms is explicitly false, even with EditAll true', async () => {
    mockUseGenericContextResult.permissions = {
      ...ENTITY_PERMISSIONS,
      EditGlossaryTerms: false,
    } as OperationPermission;

    render(<ContainerWidget />);

    expect(
      await screen.findByTestId('glossary-edit-access')
    ).toHaveTextContent('false');
  });

  it('denies tag edit when EditTags is explicitly false, even with EditAll true', async () => {
    mockUseGenericContextResult.permissions = {
      ...ENTITY_PERMISSIONS,
      EditTags: false,
    } as OperationPermission;

    render(<ContainerWidget />);

    expect(await screen.findByTestId('tag-edit-access')).toHaveTextContent(
      'false'
    );
  });

  it('gates all edit flags off and marks read-only when the container is deleted', async () => {
    mockUseGenericContextResult.data = {
      ...mockContainerWithDataModel,
      deleted: true,
    };

    render(<ContainerWidget />);

    expect(await screen.findByTestId('is-read-only')).toHaveTextContent(
      'true'
    );
    expect(
      screen.getByTestId('description-edit-access')
    ).toHaveTextContent('false');
    expect(screen.getByTestId('glossary-edit-access')).toHaveTextContent(
      'false'
    );
    expect(screen.getByTestId('tag-edit-access')).toHaveTextContent('false');
  });
});
