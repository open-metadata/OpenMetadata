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
import { useQuery } from '@tanstack/react-query';
import { Page, PageType } from '../generated/system/ui/page';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import {
  docStoreQueryFn,
  docStoreQueryKey,
  personaDocFqn,
  PERSONA_DOC_STALE_TIME,
} from '../rest/queries/docStoreQuery';
import { useApplicationStore } from './useApplicationStore';

export const useCustomPages = (pageType: PageType | 'Navigation') => {
  const { selectedPersona } = useApplicationStore();
  const fqn = personaDocFqn(selectedPersona);

  const {
    data: doc,
    isPending,
    isError,
  } = useQuery({
    queryKey: docStoreQueryKey(fqn ?? ''),
    queryFn: docStoreQueryFn(fqn ?? ''),
    enabled: !!fqn,
    retry: false,
    staleTime: PERSONA_DOC_STALE_TIME,
  });

  return {
    customizedPage:
      (doc?.data?.pages?.find((p: Page | null) => p?.pageType === pageType) as
        | Page
        | undefined) ?? null,
    // Reset to [] on error to clear stale navigation items, null when no persona selected.
    navigation: isError
      ? ([] as NavigationItem[])
      : ((doc?.data?.navigation ?? null) as NavigationItem[] | null),
    isLoading: !!fqn && isPending,
  };
};
