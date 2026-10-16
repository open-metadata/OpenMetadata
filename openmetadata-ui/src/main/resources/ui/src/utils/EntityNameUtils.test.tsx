/*
 *  Copyright 2023 Collate.
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
import { DEFAULT_DOMAIN_VALUE } from '../constants/constants';
import { getDomainDisplayName } from './EntityNameUtils';

jest.mock('../constants/constants', () => ({
  DEFAULT_DOMAIN_VALUE: 'All Domains',
  getEntityDetailsPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
}));

jest.mock('i18next', () => ({
  t: jest.fn((key) => {
    const translations: Record<string, string> = {
      'label.all-domain-plural': 'All Domains',
    };

    return translations[key] || key;
  }),
}));

describe('EntityNameUtils unit tests', () => {
  describe('getDomainDisplayName', () => {
    it('should return entity name when activeDomainEntityRef is provided', () => {
      const mockEntityRef = {
        id: '123',
        name: 'Engineering',
        displayName: 'Engineering Domain',
        type: 'domain',
      };

      const result = getDomainDisplayName(mockEntityRef);

      expect(result).toBe('Engineering Domain');
    });

    it('should return entity name without displayName when activeDomainEntityRef has only name', () => {
      const mockEntityRef = {
        id: '123',
        name: 'Engineering',
        type: 'domain',
      };

      const result = getDomainDisplayName(mockEntityRef);

      expect(result).toBe('Engineering');
    });

    it('should return translated "label.all-domain-plural" when activeDomain is DEFAULT_DOMAIN_VALUE', () => {
      const result = getDomainDisplayName(undefined, DEFAULT_DOMAIN_VALUE);

      expect(result).toBe('label.all-domain-plural');
    });

    it('should return custom domain name when activeDomain is a custom value', () => {
      const customDomain = 'custom-domain';

      const result = getDomainDisplayName(undefined, customDomain);

      expect(result).toBe(customDomain);
    });

    it('should return undefined when both parameters are undefined', () => {
      const result = getDomainDisplayName();

      expect(result).toBe(undefined);
    });

    it('should prioritize activeDomainEntityRef over activeDomain', () => {
      const mockEntityRef = {
        id: '123',
        name: 'Engineering',
        displayName: 'Engineering Domain',
        type: 'domain',
      };

      const result = getDomainDisplayName(mockEntityRef, DEFAULT_DOMAIN_VALUE);

      expect(result).toBe('Engineering Domain');
    });
  });
});
