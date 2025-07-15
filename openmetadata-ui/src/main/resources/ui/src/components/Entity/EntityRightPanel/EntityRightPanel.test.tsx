/*
 *  Copyright 2023 Collate.
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
import { EntityTags } from 'Models';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import entityRightPanelClassBase from '../../../utils/EntityRightPanelClassBase';
import EntityRightPanel from './EntityRightPanel';

const editPermission = true;

jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => {
    return jest.fn().mockImplementation(() => <div>DataProductsContainer</div>);
  }
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <div>TagsContainerV2</div>);
});

jest.mock('../../../utils/EntityRightPanelClassBase');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({
    fqn: 'fqn',
    tab: 'tab',
    version: 'version',
  })),
  Link: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => <a {...rest}>{children}</a>),
}));

jest.mock(
  '../../../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component',
  () => ({
    PartitionedKeys: jest
      .fn()
      .mockImplementation(() => <div>PartitionedKeys</div>),
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: {
      tableDetails: {
        joins: [],
      },
      extension: {
        test1: 'test',
        test2: '',
      },
    },
    onThreadLinkSelect: jest.fn(),
    filterWidgets: jest.fn(),
  })),
}));

describe('EntityRightPanel component test', () => {
  const mockSelectedTags: EntityTags[] = [];
  const mockOnTagSelectionChange = jest.fn();
  const mockCustomProperties = {
    extension: {
      test1: 'test',
      test2: '',
    },
  } as Table;

  it('Component should render', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.getByText('DataProductsContainer')).toBeInTheDocument();
    expect(screen.getAllByText('TagsContainerV2')).toHaveLength(2);
  });

  it('Component should not render DataProductsContainer when showDataProductContainer is false', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.queryByText('DataProductsContainer')).not.toBeInTheDocument();
  });

  it('Component should render before and after slot', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        afterSlot={<div>afterSlot</div>}
        beforeSlot={<div>beforeSlot</div>}
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.getByText('beforeSlot')).toBeInTheDocument();
    expect(screen.getByText('afterSlot')).toBeInTheDocument();
  });

  it('Component should not render before and after slot when not provided', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.queryByText('beforeSlot')).not.toBeInTheDocument();
    expect(screen.queryByText('afterSlot')).not.toBeInTheDocument();
  });

  it('Component should render KnowledgeArticles when getKnowLedgeArticlesWidget is not null', () => {
    const KnowledgeArticles = () => (
      <div data-testid="KnowledgeArticles">KnowledgeArticles</div>
    );
    const spy = jest
      .spyOn(entityRightPanelClassBase, 'getKnowLedgeArticlesWidget')
      .mockImplementation(() => KnowledgeArticles);
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(spy).toHaveBeenCalled();

    expect(screen.getByText('KnowledgeArticles')).toBeInTheDocument();
  });

  it('Component should not render KnowledgeArticles when getKnowLedgeArticlesWidget is null', () => {
    const spy = jest
      .spyOn(entityRightPanelClassBase, 'getKnowLedgeArticlesWidget')
      .mockImplementation(() => null);
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        customProperties={mockCustomProperties}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(spy).toHaveBeenCalled();

    expect(screen.queryByText('KnowledgeArticles')).not.toBeInTheDocument();
  });

  it('should not render CustomPropertyTable when no custom properties', () => {
    render(
      <EntityRightPanel
        editGlossaryTermsPermission
        editTagPermission
        viewAllPermission
        customProperties={{} as Table}
        editCustomAttributePermission={editPermission}
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
      />
    );

    expect(screen.queryByText('CustomPropertyTable')).not.toBeInTheDocument();
  });
});
