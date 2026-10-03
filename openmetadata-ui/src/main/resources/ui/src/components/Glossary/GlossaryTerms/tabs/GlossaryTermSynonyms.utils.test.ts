/*
 *  Copyright 2022 Collate.
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
import { findDuplicateSynonym } from './GlossaryTermSynonyms.utils';

describe('findDuplicateSynonym', () => {
  const synonyms = ['test', 'Revenue'];

  it('matches regardless of case and surrounding spaces', () => {
    expect(findDuplicateSynonym(synonyms, 'Test')).toBe('test');
    expect(findDuplicateSynonym(synonyms, '  revenue ')).toBe('Revenue');
  });

  it('returns undefined for a new synonym', () => {
    expect(findDuplicateSynonym(synonyms, 'turnover')).toBeUndefined();
  });

  it('returns undefined for blank input', () => {
    expect(findDuplicateSynonym(synonyms, '   ')).toBeUndefined();
    expect(findDuplicateSynonym([], '')).toBeUndefined();
  });
});
