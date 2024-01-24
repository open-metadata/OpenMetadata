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
import { Button } from 'antd';
import { AxiosError } from 'axios';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MetaPilotIcon } from '../../../assets/svg/ic-metapilot.svg';
import { Suggestion } from '../../../generated/entity/feed/suggestion';
import { getMetaPilotSuggestionsList } from '../../../rest/suggestionsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  MetaPilotContextProps,
  MetaPilotContextType,
} from './MetaPilotProvider.interface';

export const MetaPilotContext = createContext({} as MetaPilotContextType);

const MetaPilotProvider = ({ children }: MetaPilotContextProps) => {
  const { t } = useTranslation();
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [isMetaPilotEnabled, setIsMetaPilotEnabled] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<
    Suggestion | undefined
  >();
  const [entityFqn, setEntityFqn] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async (entityFQN: string) => {
    setLoading(true);
    try {
      const res = await getMetaPilotSuggestionsList({
        entityFQN,
      });
      setSuggestions(res.data);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.lineage-data-lowercase'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const onToggleSuggestionsVisible = useCallback((state: boolean) => {
    setSuggestionsVisible(state);
  }, []);

  const onMetaPilotEnableUpdate = useCallback((state: boolean) => {
    setIsMetaPilotEnabled(state);
  }, []);

  const onUpdateActiveSuggestion = useCallback((suggestion?: Suggestion) => {
    setActiveSuggestion(suggestion);
  }, []);

  const onUpdateEntityFqn = useCallback((entityFqn: string) => {
    setEntityFqn(entityFqn);
  }, []);

  const resetMetaPilot = () => {
    setSuggestionsVisible(false);
    setIsMetaPilotEnabled(false);
    setActiveSuggestion(undefined);
    setEntityFqn('');
  };

  useEffect(() => {
    fetchSuggestions(entityFqn);
  }, [entityFqn]);

  const metaPilotContextObj = useMemo(() => {
    return {
      suggestionsVisible,
      isMetaPilotEnabled,
      suggestions,
      activeSuggestion,
      entityFqn,
      loading,
      onToggleSuggestionsVisible,
      onUpdateEntityFqn,
      onMetaPilotEnableUpdate,
      onUpdateActiveSuggestion,
      fetchSuggestions,
      resetMetaPilot,
    };
  }, [
    suggestionsVisible,
    isMetaPilotEnabled,
    suggestions,
    activeSuggestion,
    entityFqn,
    loading,
    onToggleSuggestionsVisible,
    onUpdateEntityFqn,
    onMetaPilotEnableUpdate,
    onUpdateActiveSuggestion,
    fetchSuggestions,
    resetMetaPilot,
  ]);

  return (
    <MetaPilotContext.Provider value={metaPilotContextObj}>
      {children}
      {isMetaPilotEnabled && (
        <div className="floating-button-container">
          <Button
            icon={<MetaPilotIcon height={60} width={60} />}
            shape="circle"
            style={{ height: '60px', width: '60px' }}
            type="text"
            onClick={() => onToggleSuggestionsVisible(true)}
          />
        </div>
      )}
    </MetaPilotContext.Provider>
  );
};

export const useMetaPilotContext = () => useContext(MetaPilotContext);

export default MetaPilotProvider;
