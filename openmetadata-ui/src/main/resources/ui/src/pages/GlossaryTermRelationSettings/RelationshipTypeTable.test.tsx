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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  Category,
  Characteristic,
  PaletteKey,
} from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import RelationshipTypeTable from './RelationshipTypeTable';

describe('RelationshipTypeTable', () => {
  it('renders localized ontology labels instead of schema enum values', () => {
    const relationshipType = createRelationshipTypeMock({
      category: Category.OwlSkos,
      characteristics: [Characteristic.InverseFunctional],
      paletteKey: PaletteKey.Green,
    });

    render(
      <RelationshipTypeTable
        isAdminUser
        relationshipTypes={[relationshipType]}
        usageCounts={{}}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('label.owl-skos')).toBeInTheDocument();
    expect(screen.getByText('label.inverse-functional')).toBeInTheDocument();
    expect(screen.getByText('label.color-green')).toBeInTheDocument();
    expect(screen.queryByText(Category.OwlSkos)).not.toBeInTheDocument();
  });

  it('protects system and in-use types while allowing an unused custom type to be deleted', () => {
    const onDelete = jest.fn();
    const systemType = createRelationshipTypeMock({
      id: 'system-id',
      name: 'broader',
      systemDefined: true,
    });
    const inUseType = createRelationshipTypeMock({
      id: 'in-use-id',
      name: 'governedBy',
      systemDefined: false,
    });
    const unusedType = createRelationshipTypeMock({
      id: 'unused-id',
      name: 'supersedes',
      systemDefined: false,
    });

    render(
      <RelationshipTypeTable
        isAdminUser
        relationshipTypes={[systemType, inUseType, unusedType]}
        usageCounts={{ governedBy: 2 }}
        onDelete={onDelete}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByTestId('delete-broader-btn')).toBeDisabled();
    expect(screen.getByTestId('delete-governedBy-btn')).toBeDisabled();

    fireEvent.click(screen.getByTestId('delete-supersedes-btn'));

    expect(onDelete).toHaveBeenCalledWith(unusedType);
  });
});
