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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLearningResourcesList,
  LearningResource,
} from '../../../rest/learningResourceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import type { LearningResourceFilterState } from './useLearningResourceFilters';

const matchesFilters = (
  resource: LearningResource,
  searchText: string,
  filters: LearningResourceFilterState
): boolean => {
  if (searchText) {
    const q = searchText.toLowerCase();
    if (
      !resource.name.toLowerCase().includes(q) &&
      !resource.displayName?.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  if (filters.type?.length && !filters.type.includes(resource.resourceType)) {
    return false;
  }
  const { category, context, status } = filters;
  if (
    category?.length &&
    !resource.categories?.some((c) => category.includes(c))
  ) {
    return false;
  }
  if (
    context?.length &&
    !resource.contexts?.some((c) => context.includes(c.pageId))
  ) {
    return false;
  }
  if (status?.length && !status.includes(resource.status ?? 'Active')) {
    return false;
  }

  return true;
};

interface UseLearningResourcesParams {
  searchText: string;
  filterState: LearningResourceFilterState;
}

interface UseLearningResourcesReturn {
  resources: LearningResource[];
  filteredResources: LearningResource[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export const useLearningResources = ({
  searchText,
  filterState,
}: UseLearningResourcesParams): UseLearningResourcesReturn => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiParams: Parameters<typeof getLearningResourcesList>[0] = {
        limit: 100,
        fields: 'categories,contexts,difficulty,estimatedDuration,owners',
      };

      const response = await getLearningResourcesList(apiParams);
      setResources(response.data ?? []);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.learning-resources-fetch-error')
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filteredResources = useMemo(
    () => resources.filter((r) => matchesFilters(r, searchText, filterState)),
    [resources, searchText, filterState]
  );

  return {
    resources,
    filteredResources,
    isLoading,
    refetch: fetchResources,
  };
};
