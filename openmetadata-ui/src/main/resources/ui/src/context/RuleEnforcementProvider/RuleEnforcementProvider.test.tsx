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

import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../enums/entity.enum';
import { RuleType } from '../../generated/system/entityRules';
import { getEntityRules } from '../../rest/ruleEnforcementAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  RuleEnforcementProvider,
  useRuleEnforcement,
} from './RuleEnforcementProvider';

jest.mock('../../rest/ruleEnforcementAPI');
jest.mock('../../utils/ToastUtils');

const mockGetEntityRules = getEntityRules as jest.MockedFunction<
  typeof getEntityRules
>;
const mockShowErrorToast = showErrorToast as jest.MockedFunction<
  typeof showErrorToast
>;

describe('RuleEnforcementProvider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchRulesForEntity', () => {
    it('should fetch and parse rules for entity type', async () => {
      const mockRules = [
        {
          name: 'Glossary Rule',
          description: 'Tables can only have a single Glossary Term',
          rule: JSON.stringify({
            '<=': [
              {
                length: [{ filterTagsBySource: [{ var: 'tags' }, 'Glossary'] }],
              },
              1,
            ],
          }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system' as const,
        },
      ];

      mockGetEntityRules.mockResolvedValue({ data: mockRules } as any);

      const { result } = renderHook(() => useRuleEnforcement(), { wrapper });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      const rules = result.current.getRulesForEntity(EntityType.TABLE);

      expect(rules).toHaveLength(1);
      expect(rules[0].type).toBe(RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE);
      expect(rules[0].enabled).toBe(true);
    });

    it('should not fetch rules if already loaded', async () => {
      const mockRules = [
        {
          name: 'Test Rule',
          description: 'Test',
          rule: JSON.stringify({ test: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system' as const,
        },
      ];

      mockGetEntityRules.mockResolvedValue({ data: mockRules } as any);

      const { result } = renderHook(() => useRuleEnforcement(), { wrapper });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.DASHBOARD);
      });

      mockGetEntityRules.mockClear();

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.DASHBOARD);
      });

      expect(mockGetEntityRules).not.toHaveBeenCalled();
    });
  });

  describe('getUIHintsForEntity', () => {
    it('should return UI hints for glossary term rule', async () => {
      const mockRules = [
        {
          name: 'Glossary Rule',
          description: 'Tables can only have a single Glossary Term',
          rule: JSON.stringify({
            '<=': [
              {
                length: [{ filterTagsBySource: [{ var: 'tags' }, 'Glossary'] }],
              },
              1,
            ],
          }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system' as const,
        },
      ];

      mockGetEntityRules.mockResolvedValue({ data: mockRules } as any);

      const { result } = renderHook(() => useRuleEnforcement(), { wrapper });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      const hints = result.current.getUIHintsForEntity(EntityType.TABLE);

      expect(hints.canAddMultipleGlossaryTermTable).toBe(false);
      expect(hints.warnings).toContain(
        'Tables can only have a single Glossary Term'
      );
    });
  });

  describe('initialEntityTypes', () => {
    it('should load initial entity types on mount', async () => {
      const mockRules = [
        {
          name: 'Test Rule',
          description: 'Test',
          rule: JSON.stringify({ test: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system' as const,
        },
      ];

      mockGetEntityRules.mockResolvedValue({ data: mockRules } as any);

      const wrapperWithInitial = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <RuleEnforcementProvider
          initialEntityTypes={[EntityType.TABLE, EntityType.DASHBOARD]}>
          {children}
        </RuleEnforcementProvider>
      );

      renderHook(() => useRuleEnforcement(), { wrapper: wrapperWithInitial });

      await waitFor(() => {
        expect(mockGetEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
        expect(mockGetEntityRules).toHaveBeenCalledWith(EntityType.DASHBOARD);
      });
    });
  });

  describe('context error handling', () => {
    it('should throw error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useRuleEnforcement());
      }).toThrow(
        'useRuleEnforcement must be used within a RuleEnforcementProvider'
      );

      consoleError.mockRestore();
    });
  });
});
