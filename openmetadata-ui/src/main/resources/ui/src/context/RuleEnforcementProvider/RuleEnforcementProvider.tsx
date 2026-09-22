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

import { AxiosError } from 'axios';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EntityType } from '../../enums/entity.enum';
import { getEntityRules } from '../../rest/ruleEnforcementAPI';
import {
  getEntityRulesValidation,
  parseRule,
} from '../../utils/RuleEnforcementUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ParsedRule,
  RuleEnforcementContextType,
} from './RuleEnforcementProvider.interface';

const RuleEnforcementContext = createContext<RuleEnforcementContextType>(
  {} as RuleEnforcementContextType
);
interface RuleEnforcementProviderProps {
  children: React.ReactNode;
}

export const RuleEnforcementProvider: React.FC<
  RuleEnforcementProviderProps
> = ({ children }) => {
  const [rules, setRules] = useState<Record<string, ParsedRule[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  // Refs are used instead of `useState<Set>` for the dedupe state so the
  // `fetchRulesForEntity` callback can be stable. The previous version put
  // `loadedEntityTypes` in the deps, which made `fetchRulesForEntity` a fresh
  // reference whenever the Set changed; consumers' useEffects then re-fired
  // and issued duplicate `/api/v1/system/settings/entityRulesSettings/{type}`
  // requests. Tracking *in-flight* promises (not just *completed* fetches)
  // also collapses the double-mount race when two components mount in the
  // same tick (e.g. DataAssetsHeader + GenericProvider both calling
  // useEntityRules('container')).
  const loadedEntityTypes = useRef<Set<string>>(new Set());
  const inFlight = useRef<Map<string, Promise<void>>>(new Map());
  // Counter of *currently* in-flight fetches. Tracked separately from
  // `inFlight.size` because two concurrent fetches for different entity types
  // both call setIsLoading; if we only watch the boolean, the first to settle
  // flips it to false while the second is still running. The counter ensures
  // `isLoading` stays true until the last fetch resolves.
  const activeFetchCount = useRef(0);

  const fetchRulesForEntity = useCallback(async (entityType: EntityType) => {
    if (loadedEntityTypes.current.has(entityType)) {
      return;
    }
    const existing = inFlight.current.get(entityType);
    if (existing) {
      return existing;
    }

    activeFetchCount.current += 1;
    setIsLoading(true);
    const promise = (async () => {
      try {
        const response = await getEntityRules(entityType);
        const parsedRules = response.map(parseRule);

        setRules((prev) => ({
          ...prev,
          [entityType]: parsedRules,
        }));

        loadedEntityTypes.current.add(entityType);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        inFlight.current.delete(entityType);
        activeFetchCount.current -= 1;
        if (activeFetchCount.current === 0) {
          setIsLoading(false);
        }
      }
    })();
    inFlight.current.set(entityType, promise);

    return promise;
  }, []);

  const getRulesForEntity = useCallback(
    (entityType: EntityType): ParsedRule[] => {
      return rules[entityType] || [];
    },
    [rules]
  );

  const getEntityRuleValidation = useCallback(
    (entityType: EntityType) => {
      const entityRules = getRulesForEntity(entityType);

      return getEntityRulesValidation(entityRules, entityType);
    },
    [getRulesForEntity]
  );

  const contextValue = useMemo(
    () => ({
      rules,
      isLoading,
      fetchRulesForEntity,
      getRulesForEntity,
      getEntityRuleValidation,
    }),
    [
      rules,
      isLoading,
      fetchRulesForEntity,
      getRulesForEntity,
      getEntityRuleValidation,
    ]
  );

  return (
    <RuleEnforcementContext.Provider value={contextValue}>
      {children}
    </RuleEnforcementContext.Provider>
  );
};

export const useRuleEnforcementProvider = () =>
  useContext(RuleEnforcementContext);

export default RuleEnforcementProvider;
