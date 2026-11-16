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
import userEvent from '@testing-library/user-event';
import {
  Category,
  PaletteKey,
} from '../../generated/entity/data/relationshipType';
import { useIsAiMode } from '../../hooks/useAppMode';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../test/unit/enUsTranslation';
import RelationshipTypePicker from './RelationshipTypePicker.component';

jest.mock('../../rest/ontologyAPI', () => ({
  listRelationshipTypes: jest.fn(),
}));

jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;

const PART_OF = 'https://open-metadata.org/ontology/partOf';
const HAS_PART = 'https://open-metadata.org/ontology/hasPart';

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
    name: 'narrower',
    displayName: 'Narrower',
    category: Category.OwlSkos,
    characteristics: [],
    crossGlossaryAllowed: true,
    description: 'Narrower concept',
    fullyQualifiedName: 'narrower',
    id: 'narrower-id',
    inverse: { id: 'broader-id', name: 'broader', type: 'relationshipType' },
    paletteKey: PaletteKey.Indigo,
    rdfPredicate: 'http://www.w3.org/2004/02/skos/core#narrower',
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
    expect(screen.getByTestId('relation-type-broader')).toHaveTextContent(
      'Broaderlabel.inverse: Narrower'
    );
  });

  it('renders native groups keyed by predicate IRI with their inverse labels', () => {
    const onSelect = jest.fn();
    render(
      <RelationshipTypePicker
        groups={[
          {
            id: 'core',
            title: 'Core · OWL / SKOS',
            options: [
              {
                id: PART_OF,
                label: 'Part Of',
                inverseLabel: 'Has Part',
                paletteKey: PaletteKey.Teal,
              },
              {
                id: HAS_PART,
                label: 'Has Part',
                inverseLabel: 'Part Of',
                paletteKey: PaletteKey.Blue,
              },
            ],
          },
          {
            id: 'custom',
            title: 'Custom · Admin-defined',
            options: [
              {
                id: 'urn:retail:servedBy',
                label: 'served by',
                inverseLabel: 'serves',
                paletteKey: PaletteKey.Blue,
              },
            ],
          },
        ]}
        sourceLabel="Account"
        targetLabel="Customer"
        onSelect={onSelect}
      />
    );

    expect(screen.getByTestId(`relation-type-${PART_OF}`)).toHaveTextContent(
      'Part Oflabel.inverse: Has Part'
    );
    expect(screen.getByTestId('group-custom')).toHaveTextContent(
      'served bylabel.inverse: serves'
    );

    fireEvent.change(screen.getByTestId('relation-type-search'), {
      target: { value: 'ships to' },
    });

    expect(screen.getByTestId('no-relation-types')).toBeInTheDocument();
    expect(
      screen.queryByTestId('relation-type-create')
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('relation-type-search'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId(`relation-type-${PART_OF}`));

    expect(onSelect).toHaveBeenCalledWith(PART_OF);
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

  describe('server clash warning', () => {
    const GROUPS = [
      {
        id: 'core',
        title: 'Core',
        options: [
          { id: 'subClassOf', label: 'is a', paletteKey: PaletteKey.Blue },
        ],
      },
    ];
    const CLASH = 'Customer would also be a Supplier, which are disjoint.';

    it('shows the clash beside the choice and writes only after Add anyway', async () => {
      const onSelect = jest.fn();
      render(
        <RelationshipTypePicker
          groups={GROUPS}
          sourceLabel="Customer"
          targetLabel="Supplier"
          warnRelation={async () => CLASH}
          onSelect={onSelect}
        />
      );
      fireEvent.click(screen.getByTestId('relation-type-subClassOf'));

      expect(
        await screen.findByTestId('relation-clash-warning')
      ).toHaveTextContent(CLASH);
      expect(onSelect).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('relation-clash-continue'));

      expect(onSelect).toHaveBeenCalledWith('subClassOf');
    });

    it('selects at once when the server finds no clash', async () => {
      const onSelect = jest.fn();
      render(
        <RelationshipTypePicker
          groups={GROUPS}
          sourceLabel="Customer"
          targetLabel="Party"
          warnRelation={async () => undefined}
          onSelect={onSelect}
        />
      );
      fireEvent.click(screen.getByTestId('relation-type-subClassOf'));

      await waitFor(() => expect(onSelect).toHaveBeenCalledWith('subClassOf'));

      expect(screen.queryByTestId('relation-clash-warning')).toBeNull();
    });
  });

  it('offers the given groups without loading glossary relationship types', () => {
    const onSelect = jest.fn();
    render(
      <RelationshipTypePicker
        groups={[
          {
            id: 'core',
            title: 'Core',
            options: [
              {
                id: 'subClassOf',
                label: 'is a',
                inverseLabel: 'has subtype',
                paletteKey: PaletteKey.Blue,
              },
            ],
          },
          {
            id: 'object-properties',
            title: 'Object properties',
            options: [
              {
                id: 'property:placedBy',
                label: 'placed by',
                paletteKey: PaletteKey.Purple,
              },
            ],
          },
        ]}
        sourceLabel="Order"
        targetLabel="Customer"
        onSelect={onSelect}
      />
    );

    expect(mockListRelationshipTypes).not.toHaveBeenCalled();
    expect(screen.getByTestId('group-core')).toHaveTextContent(
      'Coreis alabel.inverse: has subtype'
    );

    fireEvent.click(screen.getByTestId('relation-type-property:placedBy'));

    expect(onSelect).toHaveBeenCalledWith('property:placedBy');
    expect(
      screen.queryByTestId('relation-type-create')
    ).not.toBeInTheDocument();
  });

  it('always offers a new link, named by the search text when there is one', () => {
    const onSelect = jest.fn();
    render(
      <RelationshipTypePicker
        canCreateType
        groups={[
          {
            id: 'hierarchy',
            title: 'Hierarchy',
            options: [
              { id: 'subClassOf', label: 'is a', paletteKey: PaletteKey.Blue },
            ],
          },
        ]}
        sourceLabel="Order"
        targetLabel="Customer"
        onSelect={onSelect}
      />
    );

    expect(screen.getByTestId('relation-type-create')).toHaveTextContent(
      'label.new-link'
    );

    fireEvent.click(screen.getByTestId('relation-type-create'));

    expect(onSelect).toHaveBeenLastCalledWith('new:');

    fireEvent.change(screen.getByTestId('relation-type-search'), {
      target: { value: ' ships to ' },
    });
    fireEvent.click(screen.getByTestId('relation-type-create'));

    expect(onSelect).toHaveBeenLastCalledWith('new:ships to');
  });

  it('names the typed type in the create option and drops the empty message beside it', () => {
    useEnUsTranslations();
    render(
      <RelationshipTypePicker
        canCreateType
        groups={[]}
        sourceLabel="Customer"
        targetLabel="Order"
        onSelect={jest.fn()}
      />
    );
    fireEvent.change(screen.getByTestId('relation-type-search'), {
      target: { value: 'places' },
    });

    expect(screen.getByTestId('relation-type-create')).toHaveTextContent(
      'Create relationship type ‘places’'
    );
    expect(screen.queryByTestId('no-relation-types')).not.toBeInTheDocument();

    useKeyEchoTranslations();
  });

  it('hides the new link without the right to create one', () => {
    renderPicker();

    expect(
      screen.queryByTestId('relation-type-create')
    ).not.toBeInTheDocument();
  });

  it('shows the inverse with every option, and a description as a truncated gloss with its full text on hover', async () => {
    render(
      <RelationshipTypePicker
        groups={[
          {
            id: 'relationships',
            title: 'Relationships',
            options: [
              {
                description: 'a part or component',
                id: 'partOf',
                inverseLabel: 'has part',
                label: 'part of',
                paletteKey: PaletteKey.Blue,
              },
              {
                description: 'governs',
                id: 'governs',
                inverseLabel: 'governed by',
                label: 'governs',
                paletteKey: PaletteKey.Blue,
              },
            ],
          },
        ]}
        sourceLabel="Order"
        targetLabel="Customer"
        onSelect={jest.fn()}
      />
    );

    const gloss = screen.getByTestId('relation-type-gloss-partOf');

    expect(gloss).toHaveTextContent('a part or component');
    expect(gloss).toHaveClass('tw:truncate');

    // react-aria opens hover tooltips only after it has seen a pointer move.
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    fireEvent.mouseMove(document);
    await user.hover(screen.getByTestId('relation-type-partOf'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'a part or component'
    );
    expect(screen.getByTestId('relation-type-partOf')).toHaveTextContent(
      'label.inverse: has part'
    );
    // A description that only repeats the label is not a gloss.
    expect(
      screen.queryByTestId('relation-type-gloss-governs')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('relation-type-governs')).toHaveTextContent(
      'label.inverse: governed by'
    );
  });

  it('flags relations whose domain or range leaves out the ends as other links that can still be chosen', () => {
    const onSelect = jest.fn();
    render(
      <RelationshipTypePicker
        groups={[
          {
            id: 'relationships',
            title: 'Relationships',
            options: [
              {
                domain: ['order'],
                id: 'placedBy',
                label: 'placed by',
                paletteKey: PaletteKey.Blue,
                range: ['customer'],
              },
              {
                domain: ['resource'],
                id: 'hasIdentifier',
                label: 'has identifier',
                paletteKey: PaletteKey.Blue,
                range: ['identifier'],
                scopeLabel: 'Resource → Identifier',
              },
            ],
          },
        ]}
        sourceId="order"
        sourceLabel="Order"
        targetId="customer"
        targetLabel="Customer"
        onSelect={onSelect}
      />
    );

    expect(screen.getByTestId('group-relationships')).toContainElement(
      screen.getByTestId('relation-type-placedBy')
    );

    const other = screen.getByTestId('group-other');

    expect(other).toHaveTextContent('label.other-links-doesnt-fit');
    expect(other).toContainElement(
      screen.getByTestId('relation-type-hasIdentifier')
    );
    expect(
      screen.getByTestId('relation-type-unfit-hasIdentifier')
    ).toHaveTextContent('Resource → Identifier');
    expect(
      screen.queryByTestId('relation-type-unfit-placedBy')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('relation-type-hasIdentifier')).toBeEnabled();

    fireEvent.click(screen.getByTestId('relation-type-hasIdentifier'));

    expect(onSelect).toHaveBeenCalledWith('hasIdentifier');
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

  describe('in AI mode', () => {
    beforeEach(() => {
      (useIsAiMode as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
      (useIsAiMode as jest.Mock).mockReturnValue(false);
    });

    it('keeps filtering, selection and cancel', async () => {
      const onSelect = jest.fn();
      const onCancel = jest.fn();
      renderPicker({ onCancel, onSelect });

      await waitFor(() =>
        expect(screen.getByTestId('relation-type-broader')).toBeInTheDocument()
      );
      fireEvent.change(screen.getByTestId('relation-type-search'), {
        target: { value: 'govern' },
      });
      fireEvent.click(screen.getByTestId('relation-type-governedBy'));

      expect(onSelect).toHaveBeenCalledWith('governedBy');

      fireEvent.click(screen.getByTestId('relation-type-cancel'));

      expect(onCancel).toHaveBeenCalled();
    });
  });
});
