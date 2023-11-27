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
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import EntityRightPanel from './EntityRightPanel';

jest.mock('../../DataProductsContainer/DataProductsContainer.component', () => {
  return jest.fn().mockImplementation(() => <div>DataProductsContainer</div>);
});

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <div>TagsContainerV2</div>);
});

describe('EntityRightPanel component test', () => {
  const mockDataProducts: EntityReference[] = [];
  const mockSelectedTags: EntityTags[] = [];
  const mockOnTagSelectionChange = jest.fn();
  const mockOnThreadLinkSelect = jest.fn();

  it('Component should render', () => {
    render(
      <EntityRightPanel
        editTagPermission
        dataProducts={mockDataProducts}
        entityFQN="testEntityFQN"
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        onTagSelectionChange={mockOnTagSelectionChange}
        onThreadLinkSelect={mockOnThreadLinkSelect}
      />
    );

    expect(screen.getByText('DataProductsContainer')).toBeInTheDocument();
    expect(screen.getAllByText('TagsContainerV2')).toHaveLength(2);
  });

  it('Component should not render DataProductsContainer when showDataProductContainer is false', () => {
    render(
      <EntityRightPanel
        editTagPermission
        dataProducts={mockDataProducts}
        entityFQN="testEntityFQN"
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
        onThreadLinkSelect={mockOnThreadLinkSelect}
      />
    );

    expect(screen.queryByText('DataProductsContainer')).not.toBeInTheDocument();
  });

  it('Component should render before and after slot', () => {
    render(
      <EntityRightPanel
        editTagPermission
        afterSlot={<div>afterSlot</div>}
        beforeSlot={<div>beforeSlot</div>}
        dataProducts={mockDataProducts}
        entityFQN="testEntityFQN"
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
        onThreadLinkSelect={mockOnThreadLinkSelect}
      />
    );

    expect(screen.getByText('beforeSlot')).toBeInTheDocument();
    expect(screen.getByText('afterSlot')).toBeInTheDocument();
  });

  it('Component should not render before and after slot when not provided', () => {
    render(
      <EntityRightPanel
        editTagPermission
        dataProducts={mockDataProducts}
        entityFQN="testEntityFQN"
        entityType={EntityType.TABLE}
        selectedTags={mockSelectedTags}
        showDataProductContainer={false}
        onTagSelectionChange={mockOnTagSelectionChange}
        onThreadLinkSelect={mockOnThreadLinkSelect}
      />
    );

    expect(screen.queryByText('beforeSlot')).not.toBeInTheDocument();
    expect(screen.queryByText('afterSlot')).not.toBeInTheDocument();
  });
});
