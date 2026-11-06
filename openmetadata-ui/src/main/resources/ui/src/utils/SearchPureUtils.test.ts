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
import { matchesTagSelectOption } from './SearchPureUtils';

// A tier option's value is the FQN (`Tier.Tier1`) while its title is the display
// name (`Tier1`). Matching the title alone left an FQN — what a copied filter or
// a saved rule carries — finding nothing.
describe('matchesTagSelectOption', () => {
  const TIER = { title: 'Tier1', value: 'Tier.Tier1' };

  it('matches the display name', () => {
    expect(matchesTagSelectOption(TIER, 'tier1')).toBe(true);
  });

  it('matches the fully qualified name', () => {
    expect(matchesTagSelectOption(TIER, 'Tier.Tier1')).toBe(true);
  });

  it('matches a partial value regardless of case', () => {
    expect(matchesTagSelectOption(TIER, 'TIER.')).toBe(true);
  });

  it('does not match an unrelated query', () => {
    expect(matchesTagSelectOption(TIER, 'gold')).toBe(false);
  });

  it('tolerates an option missing either field', () => {
    expect(matchesTagSelectOption({ value: 'Tier.Tier2' }, 'tier2')).toBe(true);
    expect(matchesTagSelectOption({}, 'tier')).toBe(false);
  });
});
