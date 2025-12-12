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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Typography } from 'antd';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/constants';
import { HELP_ITEMS_ENUM } from '../constants/Navbar.constants';
import { URL_OM_RELEASE_UPDATES } from '../constants/URL.constants';
import { getHelpDropdownItems } from './NavbarUtils';

describe('NavbarUtils test', () => {
  describe('getHelpDropdownItems', () => {
    it('should return helpDropdown items with correct structure', () => {
      const version = '1.3.1';
      const helpDropdownItems = getHelpDropdownItems(version);

      expect(helpDropdownItems).toHaveLength(5);
      expect(Array.isArray(helpDropdownItems)).toBe(true);

      // Verify each item has the expected structure
      helpDropdownItems.forEach((item) => {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('key');
        expect(typeof item.key).toBe('string');
      });
    });

    it('should return correct keys for all help items', () => {
      const helpDropdownItems = getHelpDropdownItems();

      const expectedKeys = [
        HELP_ITEMS_ENUM.TOUR,
        HELP_ITEMS_ENUM.DOC,
        HELP_ITEMS_ENUM.API,
        HELP_ITEMS_ENUM.SLACK,
        HELP_ITEMS_ENUM.VERSION,
      ];

      helpDropdownItems.forEach((item, index) => {
        expect(item.key).toBe(expectedKeys[index]);
      });
    });

    it('should handle version parameter correctly for version item', () => {
      const version = '2.0.0';
      const helpDropdownItems = getHelpDropdownItems(version);

      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );

      expect(versionItem).toBeDefined();
      expect(versionItem?.label.props.href).toBe(
        URL_OM_RELEASE_UPDATES.replace('{{currentVersion}}', version)
      );
    });

    it('should handle undefined version parameter', () => {
      const helpDropdownItems = getHelpDropdownItems();

      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );

      expect(versionItem).toBeDefined();
      expect(versionItem?.label.props.href).toBe(
        URL_OM_RELEASE_UPDATES.replace('{{currentVersion}}', '')
      );
    });

    it('should handle empty string version parameter', () => {
      const helpDropdownItems = getHelpDropdownItems('');

      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );

      expect(versionItem).toBeDefined();
      expect(versionItem?.label.props.href).toBe(
        URL_OM_RELEASE_UPDATES.replace('{{currentVersion}}', '')
      );
    });

    it('should render external links with correct attributes', () => {
      const helpDropdownItems = getHelpDropdownItems();

      // Test DOC item (external)
      const docItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.DOC
      );

      expect(docItem?.label.type).toBe('a');
      expect(docItem?.label.props.target).toBe('_blank');
      expect(docItem?.label.props.rel).toBe('noreferrer');
      expect(docItem?.label.props.className).toBe('no-underline');

      // Test SLACK item (external)
      const slackItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.SLACK
      );

      expect(slackItem?.label.type).toBe('a');
      expect(slackItem?.label.props.target).toBe('_blank');
      expect(slackItem?.label.props.rel).toBe('noreferrer');
      expect(slackItem?.label.props.className).toBe('no-underline');

      // Test VERSION item (external)
      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );

      expect(versionItem?.label.type).toBe('a');
      expect(versionItem?.label.props.target).toBe('_blank');
      expect(versionItem?.label.props.rel).toBe('noreferrer');
      expect(versionItem?.label.props.className).toBe('no-underline');
    });

    it('should render internal links with correct attributes', () => {
      const helpDropdownItems = getHelpDropdownItems();

      // Test TOUR item (internal)
      const tourItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.TOUR
      );

      expect(tourItem?.label.type).toBe(Link);
      expect(tourItem?.label.props.to).toBe(ROUTES.TOUR);
      expect(tourItem?.label.props.className).toBe('no-underline');

      // Test API item (internal)
      const apiItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.API
      );

      expect(apiItem?.label.type).toBe(Link);
      expect(apiItem?.label.props.to).toBe(ROUTES.SWAGGER);
      expect(apiItem?.label.props.className).toBe('no-underline');
    });

    it('should render label content with correct structure', () => {
      const helpDropdownItems = getHelpDropdownItems();

      helpDropdownItems.forEach((item) => {
        const labelContent = item.label.props.children;

        expect(labelContent.props.className).toBe('cursor-pointer');

        // Should have two columns
        const columns = labelContent.props.children;

        expect(columns).toHaveLength(2);

        // First column should have icon
        expect(columns[0].props.span).toBe(4);

        // Second column should have text and optional external link icon
        expect(columns[1].props.span).toBe(20);
        expect(columns[1].props.className).toBe('flex items-center');
      });
    });

    it('should include external link icon for external items', () => {
      const helpDropdownItems = getHelpDropdownItems();

      const externalItems = [
        HELP_ITEMS_ENUM.DOC,
        HELP_ITEMS_ENUM.SLACK,
        HELP_ITEMS_ENUM.VERSION,
      ];

      externalItems.forEach((key) => {
        const item = helpDropdownItems.find((item) => item.key === key);
        const labelContent = item?.label.props.children;
        const secondColumn = labelContent.props.children[1];

        // Should have text and external link icon
        expect(secondColumn.props.children).toHaveLength(2);

        // Second child should be the external link icon
        const externalIcon = secondColumn.props.children[1];

        expect(externalIcon.type).toBe(Icon);
        expect(externalIcon.props.className).toBe('m-l-xss text-base-color');
        expect(externalIcon.props.style).toEqual({ fontSize: '16px' });
      });
    });

    it('should not include external link icon for internal items', () => {
      const helpDropdownItems = getHelpDropdownItems();

      const internalItems = [HELP_ITEMS_ENUM.TOUR, HELP_ITEMS_ENUM.API];

      internalItems.forEach((key) => {
        const item = helpDropdownItems.find((item) => item.key === key);
        const labelContent = item?.label.props.children;
        const secondColumn = labelContent.props.children[1];

        // Should be Typography.Text
        const textElement = secondColumn.props.children[0];

        expect(textElement.type).toBe(Typography.Text);
        expect(textElement.props.className).toBe('text-base-color');
      });
    });

    it('should display version in version item label when provided', () => {
      const version = '1.5.2';
      const helpDropdownItems = getHelpDropdownItems(version);

      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );
      const labelContent = versionItem?.label.props.children;
      const secondColumn = labelContent.props.children[1];
      const textElement = secondColumn.props.children[0];

      expect(textElement.props.children).toContain(version);
    });

    it('should display question mark for version when version is undefined', () => {
      const helpDropdownItems = getHelpDropdownItems();

      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );
      const labelContent = versionItem?.label.props.children;
      const secondColumn = labelContent.props.children[1];
      const textElement = secondColumn.props.children[0];

      expect(textElement.props.children).toContain('?');
    });

    it('should handle special characters in version string', () => {
      const version = '1.0.0-beta+exp.sha.5114f85';
      const helpDropdownItems = getHelpDropdownItems(version);

      const versionItem = helpDropdownItems.find(
        (item) => item.key === HELP_ITEMS_ENUM.VERSION
      );

      expect(versionItem?.label.props.href).toBe(
        URL_OM_RELEASE_UPDATES.replace('{{currentVersion}}', version)
      );
    });
  });
});
