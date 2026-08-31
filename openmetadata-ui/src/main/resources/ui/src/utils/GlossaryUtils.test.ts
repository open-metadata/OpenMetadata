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
  permissionForApproveOrReject,
  referenceURLValidator,
  validateReferenceURL,
} from './GlossaryPureUtils';

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

  it('should hold back a nested term whose parent term is absent instead of promoting it to a root', () => {
    // Progressive expand-all paginates all levels by name, so a descendant can
    // arrive on an earlier page than its parent term. Such an orphan must be
    // held back (not rendered as a spurious root) and attach once its parent's
    // page loads.
    const orphanChild = {
      fullyQualifiedName: 'G.Parent.Child',
      name: 'Child',
      parent: {
        fullyQualifiedName: 'G.Parent',
        type: EntityType.GLOSSARY_TERM,
      },
    } as unknown as GlossaryTerm;
    const topLevel = {
      fullyQualifiedName: 'G.Top',
      name: 'Top',
    } as unknown as GlossaryTerm;
    const parentTerm = {
      fullyQualifiedName: 'G.Parent',
      name: 'Parent',
      children: [],
    } as unknown as GlossaryTerm;

    // Parent not yet loaded: only the genuine root is returned.
    expect(buildTree([orphanChild, topLevel])).toEqual([topLevel]);

    // Parent loaded on a later page: the child attaches beneath it.
    expect(buildTree([orphanChild, topLevel, parentTerm])).toEqual([
      topLevel,
      { ...parentTerm, children: [{ ...orphanChild, type: 'glossaryTerm' }] },
    ]);
  });

  it('should hold back an orphan even when the parent reference omits its type', () => {
    // The API may return a parent reference with only fqn/id and no type. The
    // orphan must still be held back rather than promoted to a spurious root.
    const orphanChild = {
      fullyQualifiedName: 'G.Parent.Child',
      name: 'Child',
      parent: { fullyQualifiedName: 'G.Parent' },
    } as unknown as GlossaryTerm;
    const topLevel = {
      fullyQualifiedName: 'G.Top',
      name: 'Top',
    } as unknown as GlossaryTerm;

    expect(buildTree([orphanChild, topLevel])).toEqual([topLevel]);
  });

  it('should treat direct children of the view root as roots when the root itself is absent', () => {
    // When expanding a term (not a glossary), the flat list holds that term's
    // descendants but not the term itself. Its direct children reference it as
    // their parent, so they must render as roots — passing the root FQN lets
    // buildTree distinguish them from orphans of a not-yet-loaded page.
    const rootTermFqn = 'G.Term1';
    const child = {
      fullyQualifiedName: 'G.Term1.Term2',
      name: 'Term2',
      children: [],
      parent: {
        fullyQualifiedName: rootTermFqn,
        type: EntityType.GLOSSARY_TERM,
      },
    } as unknown as GlossaryTerm;
    const grandChild = {
      fullyQualifiedName: 'G.Term1.Term2.Term3',
      name: 'Term3',
      parent: {
        fullyQualifiedName: 'G.Term1.Term2',
        type: EntityType.GLOSSARY_TERM,
      },
    } as unknown as GlossaryTerm;

    // Without the root FQN the direct child would be held back as an orphan.
    expect(buildTree([child, grandChild])).toEqual([]);

    // With the root FQN it renders as a root with its grandchild nested.
    expect(buildTree([child, grandChild], rootTermFqn)).toEqual([
      { ...child, children: [{ ...grandChild, type: 'glossaryTerm' }] },
    ]);
  });

  it('should keep grandchildren when an intermediate term has no inline children', () => {
    // Flat pages deliver a parent before its children, and an intermediate
    // term may arrive with an empty children field. The grandchild must still
    // appear beneath it (regression: a snapshot copy would orphan it).
    const root = {
      fullyQualifiedName: 'A',
      name: 'A',
      children: [],
    } as unknown as GlossaryTerm;
    const intermediate = {
      fullyQualifiedName: 'A.B',
      name: 'B',
      children: [],
      parent: { fullyQualifiedName: 'A', type: EntityType.GLOSSARY_TERM },
    } as unknown as GlossaryTerm;
    const leaf = {
      fullyQualifiedName: 'A.B.C',
      name: 'C',
      parent: { fullyQualifiedName: 'A.B', type: EntityType.GLOSSARY_TERM },
    } as unknown as GlossaryTerm;

    expect(buildTree([root, intermediate, leaf])).toEqual([
      {
        ...root,
        children: [
          {
            ...intermediate,
            type: 'glossaryTerm',
            children: [{ ...leaf, type: 'glossaryTerm' }],
          },
        ],
      },
    ]);
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

  it('should allow glossary review actions for task assignees even when reviewers are not hydrated', () => {
    const result = permissionForApproveOrReject(
      {
        fullyQualifiedName: '"Glossary"."Term"',
        reviewers: [],
      } as ModifiedGlossaryTerm,
      { id: 'user-1' } as never,
      {
        '<#E::glossaryTerm::"Glossary"."Term">': [
          {
            id: 'task-uuid-1',
            assignees: [{ id: 'user-1' }],
          },
        ],
      } as never
    );

    expect(result).toEqual({
      permission: true,
      taskId: 'task-uuid-1',
    });
  });

  it('should deny glossary review actions when the current user is only a reviewer and not a remaining task assignee', () => {
    const result = permissionForApproveOrReject(
      {
        fullyQualifiedName: '"Glossary"."Term"',
        reviewers: [{ id: 'user-1' }],
      } as ModifiedGlossaryTerm,
      { id: 'user-1' } as never,
      {
        '<#E::glossaryTerm::"Glossary"."Term">': [
          {
            id: 'task-uuid-1',
            assignees: [{ id: 'user-2' }],
          },
        ],
      } as never
    );

    expect(result).toEqual({
      permission: false,
      taskId: 'task-uuid-1',
    });
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
  it('should return fixed pixel column widths matching the classification table', () => {
    const columnWidthObject = glossaryTermTableColumnsWidth();

    expect(columnWidthObject).toEqual({
      description: 420,
      name: 250,
      owners: 220,
      reviewers: 200,
      status: 150,
      synonyms: 200,
    });
  });

  describe('validateReferenceURL', () => {
    it('should return true for URLs starting with http://', () => {
      expect(validateReferenceURL('http://www.example.com')).toBe(true);
      expect(validateReferenceURL('http://example.com')).toBe(true);
    });

    it('should return true for URLs starting with https://', () => {
      expect(validateReferenceURL('https://www.example.com')).toBe(true);
      expect(validateReferenceURL('https://example.com')).toBe(true);
    });

    it('should return false for URLs without http:// or https://', () => {
      expect(validateReferenceURL('www.example.com')).toBe(false);
      expect(validateReferenceURL('example.com')).toBe(false);
      expect(validateReferenceURL('ftp://example.com')).toBe(false);
    });

    it('should return true for empty string', () => {
      expect(validateReferenceURL('')).toBe(true);
    });
  });

  describe('referenceURLValidator', () => {
    it('should resolve for valid http:// URLs', async () => {
      await expect(
        referenceURLValidator({}, 'http://example.com')
      ).resolves.toBeUndefined();
    });

    it('should resolve for valid https:// URLs', async () => {
      await expect(
        referenceURLValidator({}, 'https://example.com')
      ).resolves.toBeUndefined();
    });

    it('should reject for URLs without http:// or https://', async () => {
      await expect(
        referenceURLValidator({}, 'www.example.com')
      ).rejects.toThrow('message.url-must-start-with-http-or-https');
    });

    it('should resolve for empty string', async () => {
      await expect(referenceURLValidator({}, '')).resolves.toBeUndefined();
    });
  });
});
