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
import {
  Category,
  PaletteKey,
} from '../../generated/entity/data/relationshipType';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import RelationshipTypePicker from './RelationshipTypePicker.component';

jest.mock('../../rest/ontologyAPI', () => ({
  listRelationshipTypes: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;

const RELATION_TYPES = [
  {
    name: 'broader',
    displayName: 'Broader',
    category: Category.OwlSkos,
    characteristics: [],
    crossGlossaryAllowed: true,
    description: 'Broader concept',
    fullyQualifiedName: 'broader',
    id: 'broader-id',
    inverse: { id: 'narrower-id', name: 'narrower', type: 'relationshipType' },
    paletteKey: PaletteKey.Green,
    rdfPredicate: 'http://www.w3.org/2004/02/skos/core#broader',
    systemDefined: true,
  },
  {
    name: 'governedBy',
    displayName: 'Governed By',
    category: Category.Custom,
    characteristics: [],
    crossGlossaryAllowed: true,
    description: 'Governance concept',
    fullyQualifiedName: 'governedBy',
    id: 'governed-by-id',
    paletteKey: PaletteKey.Violet,
    rdfPredicate: 'https://example.org/governedBy',
    systemDefined: false,
  },
];

describe('RelationshipTypePicker', () => {
  const renderPicker = (props?: {
    onCancel?: () => void;
    onSelect?: (relationType: string) => void;
  }) =>
    render(
      <RelationshipTypePicker
        sourceLabel="Remittance"
        targetLabel="Settlement"
        onCancel={props?.onCancel}
        onSelect={props?.onSelect ?? jest.fn()}
      />
    );

  beforeEach(() => {
    mockListRelationshipTypes.mockReset();
    mockListRelationshipTypes.mockResolvedValue({
      data: RELATION_TYPES,
      paging: { total: RELATION_TYPES.length },
    });
  });

  it('loads and groups relation types into system and custom', async () => {
    renderPicker();

    await waitFor(() =>
      expect(screen.getByTestId('relation-type-broader')).toBeInTheDocument()
    );

    expect(screen.getByTestId('relation-type-governedBy')).toBeInTheDocument();
    expect(screen.getByTestId('group-system-defined')).toBeInTheDocument();
    expect(screen.getByTestId('group-custom')).toBeInTheDocument();
  });

  it('calls onSelect with the relation type name when a type is clicked', async () => {
    const onSelect = jest.fn();
    renderPicker({ onSelect });

    await waitFor(() =>
      expect(screen.getByTestId('relation-type-broader')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('relation-type-broader'));

    expect(onSelect).toHaveBeenCalledWith('broader');
  });

  it('filters the list by the search box', async () => {
    renderPicker();

    await waitFor(() =>
      expect(screen.getByTestId('relation-type-broader')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByTestId('relation-type-search'), {
      target: { value: 'govern' },
    });

    expect(screen.getByTestId('relation-type-governedBy')).toBeInTheDocument();
    expect(
      screen.queryByTestId('relation-type-broader')
    ).not.toBeInTheDocument();
  });

  it('invokes onCancel when the cancel button is clicked', async () => {
    const onCancel = jest.fn();
    renderPicker({ onCancel });

    await waitFor(() =>
      expect(screen.getByTestId('relation-type-cancel')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('relation-type-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
