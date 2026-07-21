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
const SPARQL_FORMATS = [
  'json',
  'xml',
  'csv',
  'tsv',
  'turtle',
  'rdfxml',
  'ntriples',
  'jsonld',
] as const;
const SPARQL_INFERENCE_LEVELS = ['none', 'rdfs', 'owl', 'custom'] as const;

const upsertQuery = (
  queries: SavedSparqlQuery[],
  nextQuery: SavedSparqlQuery
): SavedSparqlQuery[] => [
  ...queries.filter((query) => query.id !== nextQuery.id),
  nextQuery,
];

const isSavedSparqlQuery = (value: unknown): value is SavedSparqlQuery => {
  const query = value as Partial<SavedSparqlQuery> | null;

  return (
    typeof query === 'object' &&
    query !== null &&
    typeof query.id === 'string' &&
    typeof query.name === 'string' &&
    typeof query.query === 'string' &&
    SPARQL_FORMATS.some((format) => format === query.format) &&
    SPARQL_INFERENCE_LEVELS.some(
      (inference) => inference === query.inference
    ) &&
    typeof query.savedAt === 'number'
  );
};

const getLegacySavedQueries = (): SavedSparqlQuery[] => {
  let savedQueries: SavedSparqlQuery[] = [];
  try {
    const serializedQueries = window.localStorage.getItem(
      LEGACY_SHARED_QUERY_STORAGE_KEY
    );
    const parsedQueries: unknown = serializedQueries
      ? JSON.parse(serializedQueries)
      : [];
    if (Array.isArray(parsedQueries)) {
      savedQueries = parsedQueries.filter(isSavedSparqlQuery);
    }
  } catch {
    savedQueries = [];
  }

  return savedQueries;
};

const mergeLegacySavedQueries = (
  serverQueries: SavedSparqlQuery[],
  legacyQueries: SavedSparqlQuery[]
): SavedSparqlQuery[] => {
  const serverQueryIds = new Set(serverQueries.map((query) => query.id));

  return [
    ...serverQueries,
    ...legacyQueries.filter((query) => !serverQueryIds.has(query.id)),
  ];
};

const removeLegacySavedQueries = () => {
  try {
    window.localStorage.removeItem(LEGACY_SHARED_QUERY_STORAGE_KEY);
  } catch {
    // Persistence already succeeded; restricted browser storage needs no recovery action.
  }
};

export const useSparqlQueryLibrary = (): UseSparqlQueryLibraryResult => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [savedQueries, setSavedQueries] = useState<SavedSparqlQuery[]>([]);
  const [queryTemplates, setQueryTemplates] = useState<SavedSparqlQuery[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadQueryLibrary = async () => {
      try {
        const [serverSavedQueries, nextQueryTemplates] = await Promise.all([
          getSavedSparqlQueries(),
          getSparqlQueryTemplates(),
        ]);
        const legacySavedQueries = getLegacySavedQueries();
        const nextSavedQueries =
          legacySavedQueries.length > 0
            ? await replaceSavedSparqlQueries(
                mergeLegacySavedQueries(serverSavedQueries, legacySavedQueries)
              )
            : serverSavedQueries;
        if (legacySavedQueries.length > 0) {
          removeLegacySavedQueries();
        }
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
