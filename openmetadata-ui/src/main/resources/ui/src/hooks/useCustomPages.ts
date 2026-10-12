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
import { useEffect, useState } from 'react';
import { PageType } from '../generated/system/ui/page';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import {
  docStoreQueryFn,
  docStoreQueryKey,
  personaDocFqn,
  PERSONA_DOC_STALE_TIME,
} from '../rest/queries/docStoreQuery';
import { getPersonaPage } from '../utils/CustomizePage/PersonaPage.utils';
import { useApplicationStore } from './useApplicationStore';

export const useCustomPages = (pageType: PageType | 'Navigation') => {
  const { selectedPersona } = useApplicationStore();
  const fqn = personaDocFqn(selectedPersona);

  const { data: doc, isError } = useQuery({
    queryKey: docStoreQueryKey(fqn ?? ''),
    queryFn: docStoreQueryFn(fqn ?? ''),
    enabled: !!fqn,
    retry: false,
    staleTime: PERSONA_DOC_STALE_TIME,
  });

  // hasMounted flips once after the first paint so entity pages always show
  // their loader on first render — identical to the old useState(true) pattern.
  // Without this, selectedPersona arrives asynchronously after first render,
  // causing isLoading to flip false→true→false in a window where
  // waitForAllLoadersToDisappear may have already returned.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  return {
    customizedPage: getPersonaPage(doc, pageType) ?? null,
    // Reset to [] on error to clear stale navigation items, null when no persona selected.
    navigation: isError
      ? ([] as NavigationItem[])
      : ((doc?.data?.navigation ?? null) as NavigationItem[] | null),
    // Only block render on the very first paint. The persona doc fetches in the
    // background after that; customizedPage/navigation update when it arrives
    // without re-showing a loader (matches the old fetchDocument behaviour).
    isLoading: !hasMounted,
  };
};
