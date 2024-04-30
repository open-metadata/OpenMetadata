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
import { EntityType } from '../enums/entity.enum';
import {
  MOCKED_GLOSSARY_TERMS,
  MOCKED_GLOSSARY_TERMS_1,
  MOCKED_GLOSSARY_TERMS_TREE,
  MOCKED_GLOSSARY_TERMS_TREE_1,
} from '../mocks/Glossary.mock';
import {
  buildTree,
  findExpandableKeys,
  findExpandableKeysForArray,
  getQueryFilterToExcludeTerm,
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
});
