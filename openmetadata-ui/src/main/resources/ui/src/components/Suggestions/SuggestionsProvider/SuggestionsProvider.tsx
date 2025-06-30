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
import { AxiosError } from 'axios';
import { isEmpty, isEqual, uniqWith } from 'lodash';

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  Suggestion,
  SuggestionType,
} from '../../../generated/entity/feed/suggestion';
import { EntityReference } from '../../../generated/entity/type';
import { useFqn } from '../../../hooks/useFqn';
import { usePub } from '../../../hooks/usePubSub';
import {
  approveRejectAllSuggestions,
  getSuggestionsByUserId,
  getSuggestionsList,
  updateSuggestionStatus,
} from '../../../rest/suggestionsAPI';
import { getSuggestionByType } from '../../../utils/Suggestion/SuggestionUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  SuggestionAction,
  SuggestionDataByTypes,
  SuggestionsContextType,
} from './SuggestionsProvider.interface';

export const SuggestionsContext = createContext({} as SuggestionsContextType);

const SuggestionsProvider = ({ children }: { children?: ReactNode }) => {
  const { t } = useTranslation();
  const { fqn: entityFqn } = useFqn();
  const [activeUser, setActiveUser] = useState<EntityReference>();
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);

  const [allSuggestionsUsers, setAllSuggestionsUsers] = useState<
    EntityReference[]
  >([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsByUser, setSuggestionsByUser] = useState<
    Map<string, SuggestionDataByTypes>
  >(new Map());
  const publish = usePub();

  const [loading, setLoading] = useState(false);
  const [suggestionLimit, setSuggestionLimit] = useState<number>(PAGE_SIZE);
  const [suggestionPendingCount, setSuggestionPendingCount] =
    useState<number>(0);
  const refreshEntity = useRef<(suggestion: Suggestion) => void>();
  const { permissions } = usePermissionProvider();

  const fetchSuggestions = useCallback(
    async (limit?: number) => {
      setLoading(true);
      try {
        const { data, paging } = await getSuggestionsList({
          entityFQN: entityFqn,
          limit: limit ?? suggestionLimit,
        });

        // Merge new suggestions with existing ones, removing duplicates by ID
        setSuggestions((prevSuggestions) => {
          const existingIds = new Set(prevSuggestions.map((s) => s.id));
          const newSuggestions = data.filter((s) => !existingIds.has(s.id));
          const mergedSuggestions = [...prevSuggestions, ...newSuggestions];

          // Update grouped suggestions with merged data
          const { allUsersList, groupedSuggestions } =
            getSuggestionByType(mergedSuggestions);
          setAllSuggestionsUsers(uniqWith(allUsersList, isEqual));
          setSuggestionsByUser(groupedSuggestions);
          setSuggestionLimit(paging.total);
          setSuggestionPendingCount(paging.total - PAGE_SIZE);

          return mergedSuggestions;
        });
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.suggestion-lowercase-plural'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [entityFqn, suggestionLimit]
  );

  const fetchSuggestionsByUserId = useCallback(
    async (userId: string, limit?: number) => {
      setLoading(true);
      try {
        const { data } = await getSuggestionsByUserId(userId, {
          entityFQN: entityFqn,
          limit: limit ?? suggestionLimit,
        });

        // Merge new suggestions with existing ones, removing duplicates by ID
        setSuggestions((prevSuggestions) => {
          const existingIds = new Set(prevSuggestions.map((s) => s.id));
          const newSuggestions = data.filter((s) => !existingIds.has(s.id));
          const mergedSuggestions = [...prevSuggestions, ...newSuggestions];

          // Update grouped suggestions with merged data
          const { allUsersList, groupedSuggestions } =
            getSuggestionByType(mergedSuggestions);
          setAllSuggestionsUsers(uniqWith(allUsersList, isEqual));
          setSuggestionsByUser(groupedSuggestions);
          setSuggestionPendingCount(suggestionLimit - mergedSuggestions.length);

          return mergedSuggestions;
        });
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.suggestion-lowercase-plural'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [entityFqn, suggestionLimit]
  );

  const acceptRejectSuggestion = useCallback(
    async (suggestion: Suggestion, status: SuggestionAction) => {
      try {
        await updateSuggestionStatus(suggestion, status);
        await fetchSuggestions();
        if (status === SuggestionAction.Accept) {
          // call component refresh function
          publish('updateDetails', suggestion);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [fetchSuggestions, refreshEntity]
  );

  const onUpdateActiveUser = useCallback(
    (user?: EntityReference) => {
      setActiveUser(user);
    },
    [suggestionsByUser]
  );

  const selectedUserSuggestions = useMemo(() => {
    return (
      suggestionsByUser.get(activeUser?.name ?? '') ?? {
        tags: [],
        description: [],
        combinedData: [],
      }
    );
  }, [activeUser, suggestionsByUser]);

  const acceptRejectAllSuggestions = useCallback(
    async (status: SuggestionAction) => {
      if (status === SuggestionAction.Accept) {
        setLoadingAccept(true);
      } else {
        setLoadingReject(true);
      }
      try {
        const promises = [
          SuggestionType.SuggestDescription,
          SuggestionType.SuggestTagLabel,
        ].map((suggestionType) =>
          approveRejectAllSuggestions(
            activeUser?.id ?? '',
            entityFqn,
            suggestionType,
            status
          )
        );

        await Promise.allSettled(promises);

        await fetchSuggestions();
        if (status === SuggestionAction.Accept) {
          selectedUserSuggestions.combinedData.forEach((suggestion) => {
            publish('updateDetails', suggestion);
          });
        }
        setActiveUser(undefined);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setLoadingAccept(false);
        setLoadingReject(false);
      }
    },
    [activeUser, entityFqn, selectedUserSuggestions, fetchSuggestions]
  );

  useEffect(() => {
    if (!isEmpty(permissions) && !isEmpty(entityFqn)) {
      fetchSuggestions(PAGE_SIZE);
    }
  }, [entityFqn, permissions]);

  const suggestionsContextObj = useMemo(() => {
    return {
      suggestions,
      suggestionLimit,
      suggestionsByUser,
      selectedUserSuggestions,
      entityFqn,
      loading,
      loadingAccept,
      loadingReject,
      allSuggestionsUsers,
      suggestionPendingCount,
      onUpdateActiveUser,
      fetchSuggestions,
      fetchSuggestionsByUserId,
      acceptRejectSuggestion,
      acceptRejectAllSuggestions,
    };
  }, [
    suggestions,
    suggestionLimit,
    suggestionsByUser,
    selectedUserSuggestions,
    entityFqn,
    loading,
    loadingAccept,
    loadingReject,
    allSuggestionsUsers,
    suggestionPendingCount,
    onUpdateActiveUser,
    fetchSuggestions,
    fetchSuggestionsByUserId,
    acceptRejectSuggestion,
    acceptRejectAllSuggestions,
  ]);

  return (
    <SuggestionsContext.Provider value={suggestionsContextObj}>
      {children}
    </SuggestionsContext.Provider>
  );
};

export const useSuggestionsContext = () => useContext(SuggestionsContext);

export default SuggestionsProvider;
