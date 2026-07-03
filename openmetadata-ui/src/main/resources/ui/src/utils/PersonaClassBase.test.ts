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

import { PageType } from '../generated/system/ui/uiCustomization';
import personaClassBase, {
  CustomizeIconKeys,
  PersonaClassBase,
} from './PersonaClassBase';

jest.mock('./i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: jest.fn((key: string) => key) },
}));

describe('PersonaClassBase', () => {
  let instance: PersonaClassBase;

  beforeEach(() => {
    instance = new PersonaClassBase();
  });

  describe('getEntityIcons', () => {
    it('returns an icon for every category and PageType key', () => {
      const icons = instance.getEntityIcons();

      expect(icons['navigation']).toBeDefined();
      expect(icons['govern']).toBeDefined();
      expect(icons['dataAssets']).toBeDefined();
      expect(icons[PageType.Table]).toBeDefined();
      expect(icons[PageType.Glossary]).toBeDefined();
    });

    it('returns the same reference on repeated calls', () => {
      expect(instance.getEntityIcons()).toBe(instance.getEntityIcons());
    });
  });

  describe('getCustomizePageCategories', () => {
    it('returns navigation, home-page, data-marketplace, governance, and data-assets categories', () => {
      const categories = instance.getCustomizePageCategories();

      expect(categories.map((category) => category.key)).toEqual([
        'navigation',
        PageType.LandingPage,
        PageType.DataMarketplace,
        'governance',
        'data-assets',
      ]);
    });

    it('derives every category icon from getEntityIcons() so overriding it changes the icons', () => {
      const customIcons = {
        ...personaClassBase.getEntityIcons(),
      } as Record<CustomizeIconKeys, SvgComponent>;
      const CustomIcon = () => null;
      customIcons['navigation'] = CustomIcon as unknown as SvgComponent;

      class CustomPersonaClassBase extends PersonaClassBase {
        public getEntityIcons(): Record<CustomizeIconKeys, SvgComponent> {
          return customIcons;
        }
      }

      const customInstance = new CustomPersonaClassBase();
      const [navigationCategory] = customInstance.getCustomizePageCategories();

      expect(navigationCategory.icon).toBe(CustomIcon);
      // The base instance is unaffected by the subclass override.
      expect(instance.getCustomizePageCategories()[0].icon).not.toBe(
        CustomIcon
      );
    });
  });

  describe('getCustomizePageOptions', () => {
    it('returns Glossary, GlossaryTerm, Domain, and DataProduct for "governance"', () => {
      const options = instance.getCustomizePageOptions('governance');

      expect(options.map((option) => option.key).sort()).toEqual(
        [
          PageType.Glossary,
          PageType.GlossaryTerm,
          PageType.Domain,
          PageType.DataProduct,
        ].sort()
      );
    });

    it('excludes governance, home-page, tag, classification, and data-marketplace PageTypes for "data-assets"', () => {
      const options = instance.getCustomizePageOptions('data-assets');
      const excluded = [
        PageType.Glossary,
        PageType.GlossaryTerm,
        PageType.Domain,
        PageType.DataProduct,
        PageType.LandingPage,
        PageType.Tag,
        PageType.Classification,
        PageType.DataMarketplace,
      ];

      expect(options.length).toBeGreaterThan(0);

      excluded.forEach((pageType) => {
        expect(options.map((option) => option.key)).not.toContain(pageType);
      });

      expect(options.map((option) => option.key)).toContain(PageType.Table);
    });

    it('returns an empty array for an unknown category', () => {
      expect(instance.getCustomizePageOptions('unknown-category')).toEqual([]);
    });

    it('builds each option label/description/icon via i18n.t() and getEntityIcons()', () => {
      const [tableOption] = instance
        .getCustomizePageOptions('data-assets')
        .filter((option) => option.key === PageType.Table);

      expect(tableOption.label).toBe('label.table');
      expect(tableOption.description).toBe(
        'message.entity-customize-description'
      );
      expect(tableOption.icon).toBe(instance.getEntityIcons()[PageType.Table]);
    });
  });

  describe('Singleton instance', () => {
    it('exports a singleton instance as default', () => {
      expect(personaClassBase).toBeInstanceOf(PersonaClassBase);
    });
  });
});
