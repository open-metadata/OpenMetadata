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

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  getSuggestionByType,
  getUniqueSuggestions,
} from '../../../utils/Suggestion/SuggestionUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  SuggestionAction,
  SuggestionsContextType,
} from './SuggestionsProvider.interface';

export const SuggestionsContext = createContext({} as SuggestionsContextType);

const SuggestionsProvider = ({ children }: { children?: ReactNode }) => {
  const { t } = useTranslation();
  const publish = usePub();
  const { fqn: entityFqn } = useFqn();
  const { permissions } = usePermissionProvider();
  const [activeUser, setActiveUser] = useState<EntityReference>();
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionLimit, setSuggestionLimit] = useState<number>(PAGE_SIZE);
  const [suggestionPendingCount, setSuggestionPendingCount] =
    useState<number>(0);

  const { allSuggestionsUsers, suggestionsByUser } = useMemo(() => {
    const { allUsersList, groupedSuggestions } =
      getSuggestionByType(suggestions);

    return {
      allSuggestionsUsers: uniqWith(allUsersList, isEqual),
      suggestionsByUser: groupedSuggestions,
    };
  }, [suggestions]);

  const fetchSuggestions = useCallback(
    async (limit?: number, skipMerge = false) => {
      setLoading(true);
      try {
        const { data, paging } = await getSuggestionsList({
          entityFQN: entityFqn,
          limit: limit ?? suggestionLimit,
        });

        let processedSuggestions: Suggestion[];

        if (skipMerge) {
          setSuggestions(data);
          processedSuggestions = data;
        } else {
          const mergedSuggestions = getUniqueSuggestions(suggestions, data);
          setSuggestions(mergedSuggestions);
          processedSuggestions = mergedSuggestions;
        }

        setSuggestionLimit(paging.total);
        setSuggestionPendingCount(paging.total - processedSuggestions.length);
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
    [entityFqn, suggestionLimit, suggestions]
  );

  const fetchSuggestionsByUserId = useCallback(
    async (userId: string, limit?: number) => {
      setLoading(true);
      try {
        const { data } = await getSuggestionsByUserId(userId, {
          entityFQN: entityFqn,
          limit: limit ?? suggestionLimit,
        });

        const mergedSuggestions = getUniqueSuggestions(suggestions, data);
        setSuggestions(mergedSuggestions);
        setSuggestionPendingCount(suggestionLimit - mergedSuggestions.length);
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
    [entityFqn, suggestionLimit, suggestions]
  );

  const acceptRejectSuggestion = useCallback(
    async (suggestion: Suggestion, status: SuggestionAction) => {
      try {
        await updateSuggestionStatus(suggestion, status);

        const updatedSuggestions = suggestions.filter(
          (s) => s.id !== suggestion.id
        );

        setSuggestions(updatedSuggestions);
        setSuggestionLimit((prev) => prev - 1);

        if (status === SuggestionAction.Accept) {
          publish('updateDetails', suggestion);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [suggestions, publish]
  );

  const onUpdateActiveUser = useCallback((user?: EntityReference) => {
    setActiveUser(user);
  }, []);

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
      if (!activeUser) {
        return;
      }

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
            activeUser.id ?? '',
            entityFqn,
            suggestionType,
            status
          )
        );

        await Promise.allSettled(promises);

        const userSuggestionsToRemove = selectedUserSuggestions.combinedData;

        const updatedSuggestions = suggestions.filter(
          (s) =>
            !userSuggestionsToRemove.some(
              (userSuggestion) => userSuggestion.id === s.id
            )
        );

        if (isEmpty(updatedSuggestions)) {
          await fetchSuggestions(undefined, true);
        } else {
          setSuggestions(updatedSuggestions);
          setSuggestionLimit(suggestionLimit - userSuggestionsToRemove.length);
        }

        if (status === SuggestionAction.Accept) {
          userSuggestionsToRemove.forEach((suggestion) => {
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
    [
      activeUser,
      entityFqn,
      selectedUserSuggestions,
      suggestions,
      suggestionLimit,
      fetchSuggestions,
      publish,
    ]
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
