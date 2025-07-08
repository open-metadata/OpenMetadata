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

import { ROUTES } from '../constants/constants';
import { HELP_ITEMS_ENUM } from '../constants/Navbar.constants';
import { URL_OM_RELEASE_UPDATES } from '../constants/URL.constants';
import { getHelpDropdownItems } from './NavbarUtils';

describe('NavbarUtils test', () => {
  it('getHelpDropdownItems should return helpDropdown items', () => {
    const version = '1.3.1';
    const helpDropdownItems = getHelpDropdownItems(version);

    expect(helpDropdownItems).toHaveLength(5);

    // Test the External item
    expect(helpDropdownItems[4].label).toBeDefined();
    expect(helpDropdownItems[4].key).toBe(HELP_ITEMS_ENUM.VERSION);

    // Test external link
    const externalLink = helpDropdownItems[5].label.props.href;

    expect(externalLink).toBe(
      URL_OM_RELEASE_UPDATES.replace('{{currentVersion}}', version)
    );
    expect(helpDropdownItems[4].label.props.target).toBe('_blank');
    expect(helpDropdownItems[4].label.props.rel).toBe('noreferrer');

    expect(JSON.stringify(helpDropdownItems[4].label.props.children)).toContain(
      '1.3.1'
    );

    // Test the Internal item
    expect(helpDropdownItems[0].label).toBeDefined();
    expect(helpDropdownItems[0].key).toBe(HELP_ITEMS_ENUM.TOUR);

    // Test internal link
    const internalLink = helpDropdownItems[0].label.props.to;

    expect(internalLink).toBe(ROUTES.TOUR);

    // Test for No link item
    expect(helpDropdownItems[4].label).toBeDefined();
    expect(helpDropdownItems[4].key).toBe(HELP_ITEMS_ENUM.VERSION);

    // Test element without link
    const noLinkElement1 = helpDropdownItems[4].label.props.href;
    const noLinkElement2 = helpDropdownItems[4].label.props.to;

    expect(noLinkElement1).toBeUndefined();
    expect(noLinkElement2).toBeUndefined();
  });
});
