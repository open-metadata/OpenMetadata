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
import { useMemo } from 'react';
import { useApplicationsProvider } from '../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import {
  docStoreQueryFn,
  docStoreQueryKey,
  personaDocFqn,
} from '../rest/queries/docStoreQuery';
import { filterHiddenNavigationItems } from '../utils/CustomizaNavigation/CustomizeNavigation';
import { useApplicationStore } from './useApplicationStore';

export const useSidebarItems = () => {
  const { selectedPersona } = useApplicationStore();
  const fqn = personaDocFqn(selectedPersona);

  const { data: doc } = useQuery({
    queryKey: docStoreQueryKey(fqn ?? ''),
    queryFn: docStoreQueryFn(fqn ?? ''),
    enabled: !!fqn,
    retry: false,
  });

  const navigation =
    (doc?.data?.navigation as NavigationItem[] | undefined) ?? null;
  const { plugins = [] } = useApplicationsProvider();

  return useMemo(
    () => filterHiddenNavigationItems(navigation, plugins),
    [navigation, plugins]
  );
};
