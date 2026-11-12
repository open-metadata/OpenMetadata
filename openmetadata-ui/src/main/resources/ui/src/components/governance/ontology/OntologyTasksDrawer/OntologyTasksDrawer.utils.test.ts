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
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { releaseBump } from './OntologyTasksDrawer.utils';

describe('releaseBump', () => {
  it.each([
    ['1.4.2', '2.0.0', VersionBump.Major],
    ['1.4.2', '1.5.0', VersionBump.Minor],
    ['1.4.2', '1.4.3', VersionBump.Patch],
    [undefined, '0.1.0', VersionBump.Minor],
    [undefined, '1.0.0', VersionBump.Major],
    [undefined, '0.0.1', VersionBump.Patch],
  ])('reads %s → %s as %s', (base, version, bump) => {
    expect(releaseBump(base, version)).toBe(bump);
  });

  it('has no bump without a version', () => {
    expect(releaseBump('1.0.0', undefined)).toBeUndefined();
  });
});
