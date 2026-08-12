/*
 *  Copyright 2024 Collate.
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

import { TagsData } from 'Models';
import { TagLabel } from '../../generated/type/tagLabel';
import { getFilteredTagsData } from './TableTags.utils';

const tag = (tagFQN: string): TagLabel => ({ tagFQN } as TagLabel);

const buildField = (
  name: string,
  tagFQNs: string[] = [],
  children?: TagsData[]
): TagsData => ({
  fullyQualifiedName: name,
  tags: tagFQNs.map(tag),
  ...(children ? { children } : {}),
});

describe('getFilteredTagsData', () => {
  it('should keep only the top-level field carrying the selected tag', () => {
    const data = [
      buildField('a', ['PII.Sensitive']),
      buildField('b', ['PersonalData.Personal']),
      buildField('c'),
    ];

    const result = getFilteredTagsData(data, ['PII.Sensitive']);

    expect(result).toHaveLength(1);
    expect(result[0].fullyQualifiedName).toBe('a');
  });

  it('should keep the parent and prune non-matching sibling children when a descendant matches', () => {
    const data = [
      buildField(
        'parent',
        [],
        [
          buildField('parent.match', ['PII.Sensitive']),
          buildField('parent.other', ['PersonalData.Personal']),
          buildField('parent.none'),
        ]
      ),
      buildField('unrelated'),
    ];

    const result = getFilteredTagsData(data, ['PII.Sensitive']);

    expect(result).toHaveLength(1);
    expect(result[0].fullyQualifiedName).toBe('parent');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children?.[0].fullyQualifiedName).toBe('parent.match');
  });

  it('should retain the full ancestor path to a deeply nested match', () => {
    const data = [
      buildField(
        'l1',
        [],
        [
          buildField(
            'l1.l2',
            [],
            [
              buildField('l1.l2.l3', ['PII.Sensitive']),
              buildField('l1.l2.other'),
            ]
          ),
        ]
      ),
    ];

    const result = getFilteredTagsData(data, ['PII.Sensitive']);

    expect(result).toHaveLength(1);
    expect(result[0].children?.[0].children).toHaveLength(1);
    expect(result[0].children?.[0].children?.[0].fullyQualifiedName).toBe(
      'l1.l2.l3'
    );
  });

  it('should show a self-tagged parent as a leaf when no children match', () => {
    const data = [
      buildField(
        'parent',
        ['PII.Sensitive'],
        [buildField('parent.child', ['PersonalData.Personal'])]
      ),
    ];

    const result = getFilteredTagsData(data, ['PII.Sensitive']);

    expect(result).toHaveLength(1);
    expect(result[0].fullyQualifiedName).toBe('parent');
    expect(result[0].children).toHaveLength(0);
  });

  it('should match any of the selected tags (union of classification and glossary)', () => {
    const data = [
      buildField('a', ['PII.Sensitive']),
      buildField('b', ['Glossary.Term']),
      buildField('c', ['PersonalData.Personal']),
    ];

    const result = getFilteredTagsData(data, [
      'PII.Sensitive',
      'Glossary.Term',
    ]);

    expect(result.map((f) => f.fullyQualifiedName)).toEqual(['a', 'b']);
  });

  it('should return an empty list when nothing matches', () => {
    const data = [buildField('a', ['PII.Sensitive']), buildField('b')];

    expect(getFilteredTagsData(data, ['Does.NotExist'])).toEqual([]);
  });

  it('should not mutate the original data', () => {
    const data = [
      buildField(
        'parent',
        [],
        [
          buildField('parent.match', ['PII.Sensitive']),
          buildField('parent.other'),
        ]
      ),
    ];

    getFilteredTagsData(data, ['PII.Sensitive']);

    expect(data[0].children).toHaveLength(2);
  });
});
