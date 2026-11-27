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
import { HeaderProperty } from '../components/DataAssets/EntityHeaderProperties/EntityHeaderProperties.types';
import { HeaderPropertyFilter } from '../constants/EntityHeaderProperties.constants';
import {
  getCustomPropertyHeaderId,
  getDefaultEntityHeader,
  getPinnedHeaderProperties,
  getShownHeaderProperties,
  matchesHeaderPropertyFilter,
  moveHeaderProperties,
  toggleHeaderProperty,
} from './EntityHeaderProperties.utils';

const property = (
  id: string,
  overrides: Partial<HeaderProperty> = {}
): HeaderProperty => ({
  id: id as HeaderProperty['id'],
  label: id,
  isEmpty: false,
  isReadOnly: false,
  content: id,
  ...overrides,
});

const owners = property('owners', { label: 'Owners' });
const tier = property('tier', { label: 'Tier', isEmpty: true });
const usage = property('usage', {
  label: 'Usage',
  isEmpty: true,
  isReadOnly: true,
});
const steward = property('extension.steward', {
  label: 'Data Steward',
  customPropertyType: 'User',
});
const properties = [owners, tier, usage, steward];

const ids = (list: HeaderProperty[]) => list.map(({ id }) => id);

describe('EntityHeaderProperties utils', () => {
  it('prefixes a custom property id so it cannot clash with a standard one', () => {
    expect(getCustomPropertyHeaderId('owners')).toBe('extension.owners');
  });

  it('defaults to the standard properties in their built-in order', () => {
    expect(getDefaultEntityHeader(properties)).toEqual({
      properties: ['owners', 'tier', 'usage'],
      showEmptyProperties: true,
    });
  });

  it('pins in saved order, once each, skipping ids the entity type lacks', () => {
    const pinned = getPinnedHeaderProperties(properties, {
      properties: ['extension.steward', 'deleted', 'owners', 'owners'],
    });

    expect(ids(pinned)).toEqual(['extension.steward', 'owners']);
  });

  it('never shows an empty read-only property but keeps an empty editable one', () => {
    const shown = getShownHeaderProperties(properties, {
      properties: ['usage', 'tier', 'owners'],
    });

    expect(ids(shown)).toEqual(['tier', 'owners']);
  });

  it('drops empty editable properties when the header hides empty ones', () => {
    const shown = getShownHeaderProperties(properties, {
      properties: ['usage', 'tier', 'owners'],
      showEmptyProperties: false,
    });

    expect(ids(shown)).toEqual(['owners']);
  });

  it('appends a property when pinned and removes it when unpinned', () => {
    const header = { properties: ['owners'], showEmptyProperties: false };

    expect(toggleHeaderProperty(header, 'tier')).toEqual({
      properties: ['owners', 'tier'],
      showEmptyProperties: false,
    });
    expect(toggleHeaderProperty(header, 'owners').properties).toEqual([]);
  });

  it.each([
    ['before', ['owners', 'usage', 'tier', 'domains']],
    ['after', ['owners', 'tier', 'usage', 'domains']],
  ] as const)('moves a property %s the drop target', (position, expected) => {
    const header = { properties: ['owners', 'tier', 'domains', 'usage'] };

    expect(
      moveHeaderProperties(header, ['usage'], 'tier', position).properties
    ).toEqual(expected);
  });

  it('leaves the order alone when the drop target is not pinned', () => {
    const header = { properties: ['owners', 'tier'] };

    expect(moveHeaderProperties(header, ['tier'], 'usage', 'before')).toBe(
      header
    );
  });

  it.each([
    [HeaderPropertyFilter.All, '', true, true],
    [HeaderPropertyFilter.Standard, '', true, false],
    [HeaderPropertyFilter.Custom, '', false, true],
    [HeaderPropertyFilter.All, '  STEW ', false, true],
  ])(
    'matches filter %s with query "%s"',
    (filter, query, matchesOwners, matchesSteward) => {
      expect(matchesHeaderPropertyFilter(owners, filter, query)).toBe(
        matchesOwners
      );
      expect(matchesHeaderPropertyFilter(steward, filter, query)).toBe(
        matchesSteward
      );
    }
  );
});
