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
import {
  isSameWorkingState,
  nextSemanticVersion,
} from './OntologyReleasePanel.utils';

describe('publication version preview', () => {
  it.each([
    [undefined, VersionBump.Major, '1.0.0'],
    ['1.4.9', VersionBump.Patch, '1.4.10'],
    ['1.4.9', VersionBump.Minor, '1.5.0'],
    ['1.4.9', VersionBump.Major, '2.0.0'],
    ['9007199254740991.0.0', VersionBump.Major, '9007199254740992.0.0'],
  ])('previews %s with %s as %s', (version, bump, expected) => {
    expect(nextSemanticVersion(version, bump)).toBe(expected);
  });

  it.each(['01.0.0', '1.0', '1.2.3-beta'])(
    'rejects invalid versions %s',
    (version) => {
      expect(() => nextSemanticVersion(version, VersionBump.Major)).toThrow();
    }
  );

  it('requires the same latest release fence across working preview pages', () => {
    const state = {
      ontologyId: 'owner',
      workingRevision: 2,
      activationRevision: 1,
      lastReleaseRevision: 3,
    };

    expect(isSameWorkingState(state, { ...state })).toBe(true);
    expect(
      isSameWorkingState(state, { ...state, lastReleaseRevision: 4 })
    ).toBe(false);
  });
});
