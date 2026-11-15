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
import { getUnpublishedCount } from './OntologyUnpublishedCount.utils';

describe('getUnpublishedCount', () => {
  it('leaves the ontology itself out before the first release', () => {
    expect(getUnpublishedCount({ unpublishedChanges: 9 })).toBe(8);
    expect(getUnpublishedCount({ unpublishedChanges: 1 })).toBe(0);
  });

  it('counts every change once a release is active', () => {
    expect(
      getUnpublishedCount({
        unpublishedChanges: 9,
        active: { releaseId: 'r1', releaseRevision: 1 },
      })
    ).toBe(9);
  });
});
