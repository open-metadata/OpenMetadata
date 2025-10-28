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

import { renderHook, waitFor } from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import { RuleType } from '../generated/system/entityRules';
import { useEntityRules } from './useEntityRules';

const mockFetchRulesForEntity = jest.fn();
const mockGetRulesForEntity = jest.fn();
const mockGetUIHintsForEntity = jest.fn();

jest.mock('../context/RuleEnforcementProvider/RuleEnforcementProvider', () => ({
  useRuleEnforcement: () => ({
    fetchRulesForEntity: mockFetchRulesForEntity,
    getRulesForEntity: mockGetRulesForEntity,
    getUIHintsForEntity: mockGetUIHintsForEntity,
    isLoading: false,
  }),
}));

describe('useEntityRules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRulesForEntity.mockReturnValue([]);
    mockGetUIHintsForEntity.mockReturnValue({
      canAddMultipleOwners: true,
      canAddTeamOwner: true,
      canAddMultipleDomains: true,
      canAddMultipleDataProducts: true,
      canAddMultipleGlossaryTermTable: true,
      maxDomains: Infinity,
      maxDataProducts: Infinity,
      requireDomainForDataProduct: false,
      warnings: [],
    });
  });

  describe('auto-fetch behavior', () => {
    it('should auto-fetch rules by default', async () => {
      renderHook(() =>
        useEntityRules({
          entityType: EntityType.TABLE,
        })
      );

      await waitFor(() => {
        expect(mockFetchRulesForEntity).toHaveBeenCalledWith(EntityType.TABLE);
      });
    });

    it('should not auto-fetch when autoFetch is false', () => {
      renderHook(() =>
        useEntityRules({
          entityType: EntityType.TABLE,
          autoFetch: false,
        })
      );

      expect(mockFetchRulesForEntity).not.toHaveBeenCalled();
    });
  });

  describe('returned values', () => {
    it('should return rules, hints, validation, and helper functions', () => {
      const mockRules = [
        {
          type: RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE,
          condition: {},
          enabled: true,
          ignoredEntities: [],
          description: 'Test rule',
          name: 'Test',
        },
      ];

      mockGetRulesForEntity.mockReturnValue(mockRules);

      const { result } = renderHook(() =>
        useEntityRules({
          entityType: EntityType.TABLE,
          autoFetch: false,
        })
      );

      expect(result.current.rules).toEqual(mockRules);
      expect(result.current.uiHints).toHaveProperty(
        'canAddMultipleGlossaryTermTable'
      );
    });
  });
});
