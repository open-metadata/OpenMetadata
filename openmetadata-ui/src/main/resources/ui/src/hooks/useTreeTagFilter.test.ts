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

import { renderHook } from '@testing-library/react';
import { TagsData } from 'Models';
import { act } from 'react';
import { TABLE_COLUMNS_KEYS } from '../constants/TableKeys.constants';
import { TagLabel } from '../generated/type/tagLabel';
import { useTreeTagFilter } from './useTreeTagFilter';

const CLASSIFICATION_TAG = 'PII.Sensitive';
const GLOSSARY_TAG = 'Glossary.Term';

const tag = (tagFQN: string): TagLabel => ({ tagFQN } as TagLabel);

const field = (name: string, tagFQNs: string[]): TagsData => ({
  fullyQualifiedName: name,
  tags: tagFQNs.map(tag),
});

const DATA: TagsData[] = [
  field('both', [CLASSIFICATION_TAG, GLOSSARY_TAG]),
  field('classificationOnly', [CLASSIFICATION_TAG]),
  field('glossaryOnly', [GLOSSARY_TAG]),
  field('untagged', ['Other.Tag']),
];

const names = (rows: TagsData[]) => rows.map((row) => row.fullyQualifiedName);

describe('useTreeTagFilter', () => {
  it('should return the data unchanged when no filter is applied', () => {
    const { result } = renderHook(() => useTreeTagFilter(DATA));

    expect(names(result.current.filteredData)).toEqual([
      'both',
      'classificationOnly',
      'glossaryOnly',
      'untagged',
    ]);
  });

  it('should prune to rows matching the single active column filter', () => {
    const { result } = renderHook(() => useTreeTagFilter(DATA));

    act(() => {
      result.current.handleTableChange(null, {
        [TABLE_COLUMNS_KEYS.TAGS]: [CLASSIFICATION_TAG],
      });
    });

    expect(names(result.current.filteredData)).toEqual([
      'both',
      'classificationOnly',
    ]);
  });

  it('should OR multiple tags selected within the same column', () => {
    const { result } = renderHook(() => useTreeTagFilter(DATA));

    act(() => {
      result.current.handleTableChange(null, {
        [TABLE_COLUMNS_KEYS.TAGS]: [CLASSIFICATION_TAG, GLOSSARY_TAG],
      });
    });

    expect(names(result.current.filteredData)).toEqual([
      'both',
      'classificationOnly',
      'glossaryOnly',
    ]);
  });

  it('should AND across the Classification and Glossary column filters', () => {
    const { result } = renderHook(() => useTreeTagFilter(DATA));

    act(() => {
      result.current.handleTableChange(null, {
        [TABLE_COLUMNS_KEYS.TAGS]: [CLASSIFICATION_TAG],
        [TABLE_COLUMNS_KEYS.GLOSSARY]: [GLOSSARY_TAG],
      });
    });

    expect(names(result.current.filteredData)).toEqual(['both']);
  });
});
