/*
 *  Copyright 2025 Collate.
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
import { EntityTabs } from '../../enums/entity.enum';
import { getRenderedActiveTab } from './CustomizePageEntityTabUtils';

// Reproduces the persona from issue #29940 that reorders Documentation off the first
// position (and can drop it entirely), so the resolved tab must come from the rendered
// list and never a hardcoded default that is not on screen.
const renderedTabs = [
  { key: EntityTabs.SUBDOMAINS, label: 'Sub Domains' },
  { key: EntityTabs.DATA_PRODUCTS, label: 'Data Products' },
  { key: EntityTabs.DOCUMENTATION, label: 'Documentation' },
  { key: EntityTabs.CUSTOM_PROPERTIES, label: 'Custom Properties' },
];

describe('getRenderedActiveTab', () => {
  it('should return the selected tab when it is in the rendered list', () => {
    expect(
      getRenderedActiveTab(
        renderedTabs,
        EntityTabs.DATA_PRODUCTS,
        EntityTabs.DOCUMENTATION
      )
    ).toBe(EntityTabs.DATA_PRODUCTS);
  });

  it('should fall back to the first rendered tab when no tab is selected', () => {
    expect(
      getRenderedActiveTab(renderedTabs, undefined, EntityTabs.DOCUMENTATION)
    ).toBe(EntityTabs.SUBDOMAINS);
  });

  it('should fall back to the first rendered tab when the selection is not rendered', () => {
    // e.g. the tree view seeds a hardcoded Documentation, or a URL deep-links a tab the
    // persona removed -- neither is on screen, so the first rendered tab wins.
    const withoutDocumentation = renderedTabs.filter(
      (tab) => tab.key !== EntityTabs.DOCUMENTATION
    );

    expect(
      getRenderedActiveTab(
        withoutDocumentation,
        EntityTabs.DOCUMENTATION,
        EntityTabs.DOCUMENTATION
      )
    ).toBe(EntityTabs.SUBDOMAINS);
  });

  it('should honour the persona order for the first tab when no tab is selected', () => {
    const reordered = [
      { key: EntityTabs.CUSTOM_PROPERTIES, label: 'Custom Properties' },
      { key: EntityTabs.DOCUMENTATION, label: 'Documentation' },
    ];

    expect(
      getRenderedActiveTab(reordered, undefined, EntityTabs.DOCUMENTATION)
    ).toBe(EntityTabs.CUSTOM_PROPERTIES);
  });

  it('should return the provided default when the rendered list is empty', () => {
    expect(getRenderedActiveTab([], undefined, EntityTabs.DOCUMENTATION)).toBe(
      EntityTabs.DOCUMENTATION
    );
  });

  it('should return the provided default when the rendered list is undefined', () => {
    expect(
      getRenderedActiveTab(undefined, undefined, EntityTabs.DOCUMENTATION)
    ).toBe(EntityTabs.DOCUMENTATION);
  });

  it('should default to the Overview tab when no default is supplied', () => {
    expect(getRenderedActiveTab([])).toBe(EntityTabs.OVERVIEW);
  });
});
