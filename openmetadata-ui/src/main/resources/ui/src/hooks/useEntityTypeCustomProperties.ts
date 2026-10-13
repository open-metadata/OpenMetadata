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
import { useQuery } from '@tanstack/react-query';
import { CustomProperty } from '../generated/type/customProperty';
import {
  typeQueryFn,
  typeQueryKey,
  TYPE_QUERY_STALE_TIME,
} from '../rest/queries/typeQuery';

const EMPTY_PROPERTIES: CustomProperty[] = [];

export const useEntityTypeCustomProperties = (entityType?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: typeQueryKey(entityType ?? ''),
    queryFn: typeQueryFn(entityType ?? ''),
    enabled: Boolean(entityType),
    staleTime: TYPE_QUERY_STALE_TIME,
  });

  return {
    customProperties: data?.customProperties ?? EMPTY_PROPERTIES,
    isLoading: Boolean(entityType) && isLoading,
    error,
  };
};
