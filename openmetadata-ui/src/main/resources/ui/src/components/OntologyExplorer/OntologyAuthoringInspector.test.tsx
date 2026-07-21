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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  ConceptMappingType,
  GlossaryTerm,
} from '../../generated/entity/data/glossaryTerm';
import { DataType } from '../../generated/type/ontologyAttribute';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import {
  getGlossaryTermsById,
  getOntologyStudioAssets,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import OntologyAuthoringInspector from './OntologyAuthoringInspector';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
  getOntologyStudioAssets: jest.fn(),
  patchGlossaryTerm: jest.fn(),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    getServiceTypeLogo: jest.fn(() => '/service.svg'),
  },
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const TERM_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_ID = '22222222-2222-2222-2222-222222222222';
const TERM: GlossaryTerm = {
  attributes: [
    {
      dataType: DataType.String,
      id: 'attribute-id',
      isIdentifier: true,
      name: 'controlCode',
    },
  ],
  conceptMappings: [
    {
      conceptIri: 'https://example.com/aml',
      mappingType: ConceptMappingType.ExactMatch,
    },
  ],
  description: '',
  glossary: { id: 'glossary-id', type: 'glossary' },
  id: TERM_ID,
  name: 'AntiMoneyLaundering',
};
const RELATIONSHIP_TYPE = createRelationshipTypeMock({
  displayName: 'Requires',
  name: 'requires',
  rdfPredicate: 'https://example.com/requires',
});

const mockGetTerm = getGlossaryTermsById as jest.MockedFunction<
  typeof getGlossaryTermsById
>;
const mockGetAssets = getOntologyStudioAssets as jest.MockedFunction<
  typeof getOntologyStudioAssets
>;

describe('OntologyAuthoringInspector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTerm.mockResolvedValue(TERM);
    mockGetAssets.mockResolvedValue({
      data: [
        {
          columnCount: 42,
          entity: {
            id: 'asset-id',
            name: 'transaction_monitoring',
            type: 'table',
          },
          service: { id: 'service-id', name: 'Snowflake', type: 'service' },
          serviceType: 'Snowflake',
        },
      ],
      paging: { limit: 3, offset: 0, total: 47 },
    });
    (patchGlossaryTerm as jest.Mock).mockResolvedValue(TERM);
  });

  it('matches the compact Edit-mode inspector contract', async () => {
    render(
      <OntologyAuthoringInspector
        isEditable
        edges={[
          {
            from: TERM_ID,
            label: 'Requires',
            relationType: 'requires',
            to: TARGET_ID,
          },
        ]}
        node={{
          fullyQualifiedName: 'finance.AntiMoneyLaundering',
          id: TERM_ID,
          label: 'Anti-Money Laundering',
          type: 'glossaryTerm',
        }}
        nodes={[
          { id: TERM_ID, label: 'Anti-Money Laundering', type: 'glossaryTerm' },
          { id: TARGET_ID, label: 'Know Your Customer', type: 'glossaryTerm' },
        ]}
        relationTypes={[RELATIONSHIP_TYPE]}
        onCreateRelation={jest.fn()}
        onShowDataAssets={jest.fn()}
      />
    );

    const inspector = screen.getByTestId('ontology-authoring-inspector');

    expect(inspector).toHaveClass(
      'tw:w-[300px]',
      'tw:p-[18px]',
      'tw:border-l',
      'tw:overflow-y-auto'
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass(
      'tw:text-[17px]',
      'tw:font-bold',
      'tw:leading-[1.25]'
    );
    expect(screen.getByText('finance.AntiMoneyLaundering')).toHaveClass(
      'tw:font-mono',
      'tw:text-[11px]'
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('ontology-attribute-controlCode')
      ).toBeInTheDocument();
      expect(screen.getByText('https://example.com/aml')).toBeInTheDocument();
      expect(screen.getByText('transaction_monitoring')).toBeInTheDocument();
    });

    expect(
      within(screen.getByTestId('authoring-relationships')).getByText(
        'Know Your Customer'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('authoring-more-assets')).toHaveTextContent(
      '+46 label.more-lowercase label.data-asset-lowercase-plural'
    );
  });

  it('creates a relationship from the inline two-step flow', async () => {
    const onCreateRelation = jest.fn().mockResolvedValue(undefined);

    render(
      <OntologyAuthoringInspector
        isEditable
        edges={[]}
        node={{ id: TERM_ID, label: 'Source', type: 'glossaryTerm' }}
        nodes={[
          { id: TERM_ID, label: 'Source', type: 'glossaryTerm' },
          { id: TARGET_ID, label: 'Target', type: 'glossaryTerm' },
        ]}
        relationTypes={[RELATIONSHIP_TYPE]}
        onCreateRelation={onCreateRelation}
        onShowDataAssets={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('authoring-add-relationship'));
    fireEvent.click(
      screen.getByTestId(`authoring-relation-type-${RELATIONSHIP_TYPE.name}`)
    );
    fireEvent.click(screen.getByTestId(`authoring-target-${TARGET_ID}`));

    await waitFor(() => {
      expect(onCreateRelation).toHaveBeenCalledWith(
        TERM_ID,
        TARGET_ID,
        RELATIONSHIP_TYPE.name
      );
    });
  });
});
