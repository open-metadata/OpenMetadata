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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { stageKey } from './LifecycleRequest.utils';

describe('LifecycleRequest utils', () => {
  it('keys a stage by its lower-case, hyphenated name', () => {
    expect(stageKey(EntityStatus.Deprecated)).toBe('deprecated');
    expect(stageKey(EntityStatus.InReview)).toBe('in-review');
  });
});
