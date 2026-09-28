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
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER } from '../../../../constants/CoreObjectFieldTemplate.constants';
import {
  getBodyClassName,
  getGatedCredentialProperties,
  getIsImpersonationOnlyDisclosure,
  getNonRootPanelClassName,
  getOrderedAdvancedPropertiesList,
  getPropertyItemClassName,
  shouldRenderNullTemplate,
} from './CoreObjectFieldTemplate.utils';

const property = (name: string) =>
  ({
    name,
    content: null,
    disabled: false,
    readonly: false,
    hidden: false,
  } as unknown as ObjectFieldTemplateProps['properties'][number]);

describe('CoreObjectFieldTemplate.utils', () => {
  describe('getPropertyItemClassName', () => {
    it('adds padded card styling for a root non-flat property', () => {
      const className = getPropertyItemClassName(
        'host',
        false,
        true,
        false,
        false,
        false
      );

      expect(className).toContain('core-object-field-template-property-host');
      expect(className).toContain('tw:rounded-xl tw:bg-utility-gray-blue-50');
      expect(className).toContain('tw:p-4');
    });

    it('omits card styling for a flat layout and adds state modifiers', () => {
      const className = getPropertyItemClassName(
        'host',
        true,
        true,
        true,
        true,
        true
      );

      expect(className).not.toContain('tw:rounded-xl');
      expect(className).not.toContain('tw:p-4');
      expect(className).toContain(
        'core-object-field-template-property-full-width'
      );
      expect(className).toContain(
        'core-object-field-template-property-toggle-banner'
      );
      expect(className).toContain(
        'core-object-field-template-property-disabled'
      );
    });

    it('does not pad a nested non-flat property', () => {
      const className = getPropertyItemClassName(
        'host',
        false,
        false,
        false,
        false,
        false
      );

      expect(className).toContain('tw:rounded-xl');
      expect(className).not.toContain('tw:p-4');
    });
  });

  describe('getOrderedAdvancedPropertiesList', () => {
    const properties = [
      property('other'),
      property(GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER[1]),
      property(GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER[0]),
    ];

    it('orders gated credential advanced properties by the shared order', () => {
      expect(
        getOrderedAdvancedPropertiesList(properties, true).map((p) => p.name)
      ).toEqual([
        GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER[0],
        GATED_CREDENTIAL_ADVANCED_PROPERTY_ORDER[1],
        'other',
      ]);
    });

    it('returns the input untouched for non-gated configs', () => {
      expect(getOrderedAdvancedPropertiesList(properties, false)).toBe(
        properties
      );
    });
  });

  describe('getGatedCredentialProperties', () => {
    const properties = [property('enabled'), property('key')];

    it('splits the enabled toggle from the field properties', () => {
      const result = getGatedCredentialProperties(properties, true);

      expect(result.toggleProperties.map((p) => p.name)).toEqual(['enabled']);
      expect(result.fieldProperties.map((p) => p.name)).toEqual(['key']);
    });

    it('returns empty lists for non-gated configs', () => {
      expect(getGatedCredentialProperties(properties, false)).toEqual({
        toggleProperties: [],
        fieldProperties: [],
      });
    });
  });

  describe('getIsImpersonationOnlyDisclosure', () => {
    it('is true only for a generic nested config with a single impersonate property', () => {
      expect(
        getIsImpersonationOnlyDisclosure(true, [property('impersonateUser')])
      ).toBe(true);
      expect(
        getIsImpersonationOnlyDisclosure(false, [property('impersonateUser')])
      ).toBe(false);
      expect(
        getIsImpersonationOnlyDisclosure(true, [
          property('impersonateUser'),
          property('other'),
        ])
      ).toBe(false);
      expect(getIsImpersonationOnlyDisclosure(true, [property('other')])).toBe(
        false
      );
    });
  });

  describe('getBodyClassName', () => {
    it('picks gated, grid, or column layout', () => {
      expect(getBodyClassName(true, true)).toBe(
        'core-object-field-template-body-gated'
      );
      expect(getBodyClassName(false, true)).toContain(
        'core-object-field-template-body-grid'
      );
      expect(getBodyClassName(false, false)).toBe(
        'tw:flex tw:flex-col tw:gap-4'
      );
    });
  });

  describe('shouldRenderNullTemplate', () => {
    it('is true only for an empty non-root object without additional properties', () => {
      expect(shouldRenderNullTemplate(false, false, 0, 0)).toBe(true);
      expect(shouldRenderNullTemplate(true, false, 0, 0)).toBe(false);
      expect(shouldRenderNullTemplate(false, true, 0, 0)).toBe(false);
      expect(shouldRenderNullTemplate(false, false, 1, 0)).toBe(false);
      expect(shouldRenderNullTemplate(false, false, 0, 1)).toBe(false);
    });
  });

  describe('getNonRootPanelClassName', () => {
    it('applies every variant class when its flag is set', () => {
      const className = getNonRootPanelClassName(
        false,
        true,
        true,
        true,
        true,
        true
      );

      expect(className).toContain('tw:rounded-xl tw:bg-utility-gray-blue-50');
      expect(className).toContain(
        'core-object-field-template-sample-data-section'
      );
      expect(className).toContain(
        'core-object-field-template-sample-data-config'
      );
      expect(className).toContain('core-object-field-template-storage-config');
      expect(className).toContain(
        'core-object-field-template-gated-credential-block'
      );
      expect(className).toContain(
        'core-object-field-template-credential-block'
      );
    });

    it('keeps only the base classes for a flat plain panel', () => {
      const className = getNonRootPanelClassName(
        true,
        false,
        false,
        false,
        false,
        false
      );

      expect(className).toBe(
        'core-object-field-template core-object-field-template-non-root tw:flex tw:flex-col tw:w-full tw:min-w-0 tw:gap-4'
      );
    });
  });
});
