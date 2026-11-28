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
import { EntityType } from '../../../enums/entity.enum';
import { TagSource } from '../../../generated/entity/data/container';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { CustomProperty } from '../../../generated/entity/type';
import { GlossaryPickerValue } from '../../common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import { getExtensionFormKey } from '../../Domain/AddDomainForm/AddDomainFormExtensionFields.utils';
import { toEntityReferenceOption } from '../AddGlossary/AddGlossary.utils';
import {
  buildGlossaryTermSavePayload,
  getGlossaryTermFormValues,
  GLOSSARY_TERM_FORM_DEFAULTS,
} from './AddGlossaryTermForm.utils';

const owner = {
  id: 'u1',
  type: EntityType.USER,
  name: 'u1',
  fullyQualifiedName: 'u1',
};

const glossaryTerm = {
  id: 'term-id',
  name: 'Revenue',
  displayName: 'Revenue',
  description: 'Money in',
  fullyQualifiedName: 'Business.Revenue',
  glossary: { id: 'g1', type: 'glossary' },
  synonyms: ['income'],
  references: [{ name: 'Wiki', endpoint: 'https://wiki' }],
  mutuallyExclusive: true,
  owners: [owner],
  reviewers: [],
  style: { color: '#123456', iconURL: 'Book' },
  relatedTerms: [
    {
      id: 'edge-1',
      relationType: 'synonym',
      provenance: 'Imported',
      status: 'Approved',
      createdBy: 'importer',
      createdAt: 1700000000000,
      term: {
        id: 'related-id',
        type: 'glossaryTerm',
        name: 'Profit',
        fullyQualifiedName: 'Business.Profit',
      },
    },
  ],
} as GlossaryTerm;

const pickedTerm = (tagFQN: string, id?: string): GlossaryPickerValue =>
  ({
    tagFQN,
    source: TagSource.Glossary,
    ...(id ? { entity: { id } } : {}),
  } as GlossaryPickerValue);

describe('getGlossaryTermFormValues', () => {
  it('returns blank defaults when there is no term', () => {
    expect(getGlossaryTermFormValues()).toEqual(GLOSSARY_TERM_FORM_DEFAULTS);
  });

  it('maps a term into picker-shaped form values', () => {
    const values = getGlossaryTermFormValues(glossaryTerm);

    expect(values).toEqual(
      expect.objectContaining({
        name: 'Revenue',
        description: 'Money in',
        synonyms: [{ id: 'income', label: 'income' }],
        references: glossaryTerm.references,
        color: '#123456',
        iconURL: 'Book',
        mutuallyExclusive: true,
        owners: [toEntityReferenceOption(owner)],
      })
    );
    expect(values.relatedTerms).toEqual([
      expect.objectContaining({
        tagFQN: 'Business.Profit',
        source: TagSource.Glossary,
      }),
    ]);
  });
});

describe('buildGlossaryTermSavePayload', () => {
  it('sends related term FQNs as TermRelation edges and intake extension values on create', () => {
    const customProperties = [
      {
        name: 'costCenter',
        propertyType: { id: 'string-id', name: 'string', type: 'type' },
      },
    ] as CustomProperty[];

    const payload = buildGlossaryTermSavePayload({
      values: {
        ...GLOSSARY_TERM_FORM_DEFAULTS,
        name: ' Revenue ',
        description: 'Money in',
        synonyms: [{ id: 'income', label: 'income' }],
        relatedTerms: [pickedTerm('Business.Profit', 'related-id')],
        extensionFormValues: { [getExtensionFormKey('costCenter')]: 'CC-1' },
      },
      editMode: false,
      currentUserId: 'me',
      customProperties,
    });

    expect(payload).toEqual({
      name: 'Revenue',
      displayName: '',
      description: 'Money in',
      reviewers: [],
      relatedTerms: [
        {
          term: {
            fullyQualifiedName: 'Business.Profit',
            type: 'glossaryTerm',
          },
        },
      ],
      references: undefined,
      synonyms: ['income'],
      mutuallyExclusive: false,
      tags: [],
      owners: [{ id: 'me', type: 'user' }],
      style: undefined,
      extension: { costCenter: 'CC-1' },
    });
  });

  it('preserves existing TermRelation metadata for untouched related terms on edit', () => {
    const payload = buildGlossaryTermSavePayload({
      values: getGlossaryTermFormValues(glossaryTerm),
      editMode: true,
      glossaryTerm,
      currentUserId: 'me',
    });

    // The seeded relation is unchanged, so the full edge metadata must survive
    // so the server's strict matcher keeps the stored typed edge.
    expect(payload.relatedTerms).toHaveLength(1);
    expect(payload.relatedTerms?.[0]).toEqual(
      expect.objectContaining({
        id: 'edge-1',
        relationType: 'synonym',
        provenance: 'Imported',
        status: 'Approved',
        createdBy: 'importer',
        createdAt: 1700000000000,
        term: expect.objectContaining({
          id: 'related-id',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Business.Profit',
        }),
      })
    );
  });

  it('resolves related term ids and drops extensions on edit', () => {
    const payload = buildGlossaryTermSavePayload({
      values: {
        ...getGlossaryTermFormValues(glossaryTerm),
        relatedTerms: [
          // Seeded from the term: the id comes from the existing relation.
          pickedTerm('Business.Profit'),
          // Newly picked: the id travels on the picked entity.
          pickedTerm('Business.Cost', 'cost-id'),
        ],
        extensionFormValues: { costCenter: 'ignored' },
      },
      editMode: true,
      glossaryTerm,
      currentUserId: 'me',
    });

    expect(payload.relatedTerms?.map((r) => r.term.id)).toEqual([
      'related-id',
      'cost-id',
    ]);
    // The seeded relation keeps its typed metadata; the newly picked one is a
    // bare reference the server defaults to `relatedTo`/`Manual`.
    expect(payload.relatedTerms?.[0]).toEqual(
      expect.objectContaining({
        relationType: 'synonym',
        provenance: 'Imported',
      })
    );
    expect(payload.relatedTerms?.[1]).toEqual({
      term: { id: 'cost-id', type: 'glossaryTerm' },
    });
    expect(payload.extension).toBeUndefined();
    expect(payload.owners).toEqual([owner]);
    expect(payload.style).toEqual({ color: '#123456', iconURL: 'Book' });
    expect(payload.references).toEqual(glossaryTerm.references);
  });

  it('leaves an edited term unowned when every owner is cleared', () => {
    const payload = buildGlossaryTermSavePayload({
      values: { ...getGlossaryTermFormValues(glossaryTerm), owners: [] },
      editMode: true,
      glossaryTerm,
      currentUserId: 'me',
    });

    expect(payload.owners).toEqual([]);
  });

  it('makes the creator the owner of a new term with no owners', () => {
    const payload = buildGlossaryTermSavePayload({
      values: {
        ...GLOSSARY_TERM_FORM_DEFAULTS,
        name: 'Revenue',
        description: 'Money in',
      },
      editMode: false,
      currentUserId: 'me',
    });

    expect(payload.owners).toEqual([{ id: 'me', type: 'user' }]);
  });
});
