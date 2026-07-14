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

import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getSavedSparqlQueries,
  getSparqlQueryTemplates,
  replaceSavedSparqlQueries,
  replaceSparqlQueryTemplates,
  SavedSparqlQuery,
} from '../rest/rdfAPI';
import { showErrorToast } from '../utils/ToastUtils';

interface UseSparqlQueryLibraryResult {
  isLoading: boolean;
  queryTemplates: SavedSparqlQuery[];
  savedQueries: SavedSparqlQuery[];
  deleteQueryTemplate: (id: string) => Promise<boolean>;
  deleteSavedQuery: (id: string) => Promise<boolean>;
  upsertQueryTemplate: (query: SavedSparqlQuery) => Promise<boolean>;
  upsertSavedQuery: (query: SavedSparqlQuery) => Promise<boolean>;
}

const LEGACY_SHARED_QUERY_STORAGE_KEY = 'om.sparql-playground.savedQueries';

const upsertQuery = (
  queries: SavedSparqlQuery[],
  nextQuery: SavedSparqlQuery
): SavedSparqlQuery[] => [
  ...queries.filter((query) => query.id !== nextQuery.id),
  nextQuery,
];

export const useSparqlQueryLibrary = (): UseSparqlQueryLibraryResult => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [savedQueries, setSavedQueries] = useState<SavedSparqlQuery[]>([]);
  const [queryTemplates, setQueryTemplates] = useState<SavedSparqlQuery[]>([]);

  useEffect(() => {
    let isMounted = true;

    try {
      window.localStorage.removeItem(LEGACY_SHARED_QUERY_STORAGE_KEY);
    } catch {
      // Browser storage can be unavailable under restrictive privacy settings.
    }

    const loadQueryLibrary = async () => {
      try {
        const [nextSavedQueries, nextQueryTemplates] = await Promise.all([
          getSavedSparqlQueries(),
          getSparqlQueryTemplates(),
        ]);
        if (isMounted) {
          setSavedQueries(nextSavedQueries);
          setQueryTemplates(nextQueryTemplates);
        }
      } catch (error) {
        if (isMounted) {
          showErrorToast(
            isAxiosError(error) ? error : t('server.unexpected-error')
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadQueryLibrary();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const upsertSavedQuery = useCallback(
    async (nextQuery: SavedSparqlQuery) => {
      try {
        const storedQueries = await replaceSavedSparqlQueries(
          upsertQuery(savedQueries, nextQuery)
        );
        setSavedQueries(storedQueries);

        return true;
      } catch (error) {
        showErrorToast(
          isAxiosError(error) ? error : t('server.unexpected-error')
        );

        return false;
      }
    },
    [savedQueries, t]
  );

  const deleteSavedQuery = useCallback(
    async (id: string) => {
      try {
        const storedQueries = await replaceSavedSparqlQueries(
          savedQueries.filter((query) => query.id !== id)
        );
        setSavedQueries(storedQueries);

        return true;
      } catch (error) {
        showErrorToast(
          isAxiosError(error) ? error : t('server.unexpected-error')
        );

        return false;
      }
    },
    [savedQueries, t]
  );

  const upsertQueryTemplate = useCallback(
    async (nextQuery: SavedSparqlQuery) => {
      try {
        const storedTemplates = await replaceSparqlQueryTemplates(
          upsertQuery(queryTemplates, nextQuery)
        );
        setQueryTemplates(storedTemplates);

        return true;
      } catch (error) {
        showErrorToast(
          isAxiosError(error) ? error : t('server.unexpected-error')
        );

        return false;
      }
    },
    [queryTemplates, t]
  );

  const deleteQueryTemplate = useCallback(
    async (id: string) => {
      try {
        const storedTemplates = await replaceSparqlQueryTemplates(
          queryTemplates.filter((query) => query.id !== id)
        );
        setQueryTemplates(storedTemplates);

        return true;
      } catch (error) {
        showErrorToast(
          isAxiosError(error) ? error : t('server.unexpected-error')
        );

        return false;
      }
    },
    [queryTemplates, t]
  );

  return {
    isLoading,
    queryTemplates,
    savedQueries,
    deleteQueryTemplate,
    deleteSavedQuery,
    upsertQueryTemplate,
    upsertSavedQuery,
  };
};
