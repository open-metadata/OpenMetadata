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
import { ModifiedGlossaryTerm } from '../components/Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import { ModifiedGlossary } from '../components/Glossary/useGlossary.store';
import { EntityType } from '../enums/entity.enum';
import { Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import {
  MOCKED_GLOSSARY_TERMS,
  MOCKED_GLOSSARY_TERMS_1,
  MOCKED_GLOSSARY_TERMS_TREE,
  MOCKED_GLOSSARY_TERMS_TREE_1,
} from '../mocks/Glossary.mock';
import {
  buildTree,
  filterTreeNodeOptions,
  findAndUpdateNested,
  findExpandableKeys,
  findExpandableKeysForArray,
  getQueryFilterToExcludeTerm,
  glossaryTermTableColumnsWidth,
} from './GlossaryUtils';

describe('Glossary Utils', () => {
  it('getQueryFilterToExcludeTerm returns the correct query filter', () => {
    const fqn = 'example';
    const expectedQueryFilter = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must_not: [
                  {
                    term: {
                      'tags.tagFQN': fqn,
                    },
                  },
                ],
              },
            },
            {
              bool: {
                must_not: [
                  {
                    term: {
                      entityType: EntityType.GLOSSARY_TERM,
                    },
                  },
                  {
                    term: {
                      entityType: EntityType.TAG,
                    },
                  },
                  {
                    term: {
                      entityType: EntityType.DATA_PRODUCT,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const queryFilter = getQueryFilterToExcludeTerm(fqn);

    expect(queryFilter).toEqual(expectedQueryFilter);
  });

  it('should build the tree correctly', () => {
    expect(buildTree(MOCKED_GLOSSARY_TERMS)).toEqual(
      MOCKED_GLOSSARY_TERMS_TREE
    );
  });

  it('should build the tree correctly when the terms with empty children are received as initial items in array', () => {
    expect(buildTree(MOCKED_GLOSSARY_TERMS_1)).toEqual(
      MOCKED_GLOSSARY_TERMS_TREE_1
    );
  });

  it('should return an empty array if no glossary term is provided', () => {
    const expandableKeys = findExpandableKeys();

    expect(expandableKeys).toEqual([]);
  });

  it('should return an array of expandable keys when glossary term has children', () => {
    const glossaryTerm = {
      fullyQualifiedName: 'example',
      children: [
        {
          fullyQualifiedName: 'child1',
          children: [
            {
              fullyQualifiedName: 'grandchild1',
            },
            {
              childrenCount: 2,
              fullyQualifiedName: 'grandchild2',
            },
          ],
        },
        {
          fullyQualifiedName: 'child2',
        },
      ],
    };

    const expandableKeys = findExpandableKeys(
      glossaryTerm as ModifiedGlossaryTerm
    );

    expect(expandableKeys).toEqual(['grandchild2', 'child1', 'example']);
  });

  it('should return an array of expandable keys when glossary term has childrenCount', () => {
    const glossaryTerm = {
      fullyQualifiedName: 'example',
      childrenCount: 2,
    };

    const expandableKeys = findExpandableKeys(
      glossaryTerm as ModifiedGlossaryTerm
    );

    expect(expandableKeys).toEqual(['example']);
  });

  it('should find expandable keys for an array of glossary terms', () => {
    const glossaryTerms = [
      {
        fullyQualifiedName: 'example1',
        children: [
          {
            fullyQualifiedName: 'child1',
          },
        ],
      },
      {
        fullyQualifiedName: 'example2',
        childrenCount: 2,
      },
      {
        fullyQualifiedName: 'example3',
      },
    ];

    const expandableKeys = findExpandableKeysForArray(
      glossaryTerms as ModifiedGlossaryTerm[]
    );

    expect(expandableKeys).toEqual(['example1', 'example2']);
  });

  it('Should return same Glossary when no filterOption is provided', () => {
    const glossary = [
      {
        fullyQualifiedName: 'example1',
        children: [
          {
            fullyQualifiedName: 'child1',
          },
        ],
      },
      {
        fullyQualifiedName: 'example2',
        childrenCount: 2,
      },
      {
        fullyQualifiedName: 'example3',
      },
    ];

    const filteredOptions = filterTreeNodeOptions(glossary as Glossary[], []);

    expect(filteredOptions).toEqual(glossary);
  });

  it('Should return filtered Glossary when filterOption is provided', () => {
    const glossary = [
      {
        fullyQualifiedName: 'example1',
        children: [
          {
            fullyQualifiedName: 'child1',
          },
        ],
      },
      {
        fullyQualifiedName: 'example3',
      },
    ];

    const expected_glossary = [
      {
        fullyQualifiedName: 'example1',
        children: [],
      },
      {
        fullyQualifiedName: 'example3',
        children: [],
      },
    ];

    const filteredOptions = filterTreeNodeOptions(glossary as Glossary[], [
      'child1',
    ]);

    expect(filteredOptions).toEqual(expected_glossary);
  });
});

describe('Glossary Utils - findAndUpdateNested', () => {
  it('should add new term to the correct parent', () => {
    const terms: ModifiedGlossary[] = [
      {
        fullyQualifiedName: 'parent1',
        children: [],
        id: 'parent1',
        name: 'parent1',
        description: 'parent1',
      },
      {
        fullyQualifiedName: 'parent2',
        children: [],
        id: 'parent2',
        name: 'parent2',
        description: 'parent2',
      },
    ];

    const newTerm: GlossaryTerm = {
      fullyQualifiedName: 'child1',
      parent: {
        fullyQualifiedName: 'parent1',
        id: 'parent1',
        type: 'Glossary',
      },
      id: 'child1',
      name: 'child1',
      description: 'child1',
      glossary: {
        fullyQualifiedName: 'child1',
        id: 'child1',
        name: 'child1',
        description: 'child1',
        type: 'Glossary',
      },
    };

    const updatedTerms = findAndUpdateNested(terms, newTerm);

    expect(updatedTerms[0].childrenCount).toBe(1);
    expect(updatedTerms[0].children).toHaveLength(1);
    expect(updatedTerms?.[0].children?.[0]).toEqual(newTerm);
  });

  it('should add new term to nested parent', () => {
    const terms: ModifiedGlossary[] = [
      {
        fullyQualifiedName: 'parent1',
        children: [
          {
            fullyQualifiedName: 'child1',
            children: [],
            glossary: {
              fullyQualifiedName: 'child1',
              id: 'child1',
              name: 'child1',
              description: 'child1',
              type: 'Glossary',
            },
            id: 'child1',
            name: 'child1',
            description: 'child1',
          },
        ],
        id: 'parent1',
        name: 'parent1',
        description: 'parent1',
      },
    ];

    const newTerm: GlossaryTerm = {
      fullyQualifiedName: 'child2',
      parent: { fullyQualifiedName: 'child1', id: 'child1', type: 'Glossary' },
      id: 'child2',
      name: 'child2',
      description: 'child2',
      glossary: {
        fullyQualifiedName: 'child2',
        id: 'child2',
        name: 'child2',
        description: 'child2',
        type: 'Glossary',
      },
    };

    const updatedTerms = findAndUpdateNested(terms, newTerm);

    const modifiedTerms = updatedTerms[0].children?.[0].children ?? [];

    expect(modifiedTerms).toHaveLength(1);
    expect(updatedTerms[0].children?.[0].childrenCount).toBe(1);
    expect(modifiedTerms[0]).toEqual(newTerm);
  });

  it('should not modify terms if parent is not found', () => {
    const terms: ModifiedGlossary[] = [
      {
        fullyQualifiedName: 'parent1',
        children: [],
        id: 'parent1',
        name: 'parent1',
        description: 'parent1',
      },
    ];

    const newTerm: GlossaryTerm = {
      fullyQualifiedName: 'child1',
      parent: {
        fullyQualifiedName: 'nonexistent',
        id: 'nonexistent',
        type: 'Glossary',
      },
      id: 'child1',
      name: 'child1',
      description: 'child1',
      glossary: {
        fullyQualifiedName: 'child1',
        id: 'child1',
        name: 'child1',
        description: 'child1',
        type: 'Glossary',
      },
    };

    const updatedTerms = findAndUpdateNested(terms, newTerm);

    expect(updatedTerms).toEqual(terms);
  });
});

describe('Glossary Utils - glossaryTermTableColumnsWidth', () => {
  it('should return columnsWidth object based on Table width', () => {
    const columnWidthObject = glossaryTermTableColumnsWidth(1000, true);

    expect(columnWidthObject).toEqual({
      description: 210,
      name: 200,
      owners: 170,
      reviewers: 330,
      status: 200,
      synonyms: 330,
    });
  });

  it('should return columnsWidth object based on Table width when not having create permission', () => {
    const columnWidthObject = glossaryTermTableColumnsWidth(1000, false);

    expect(columnWidthObject).toEqual({
      description: 330,
      name: 200,
      owners: 170,
      reviewers: 330,
      status: 200,
      synonyms: 330,
    });
  });
});
