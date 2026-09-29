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
import { ViewModePage } from '../../constants/platform/personaViewMode.constants';
import {
  docStoreQueryFn,
  docStoreQueryKey,
  personaDocFqn,
  PERSONA_DOC_STALE_TIME,
} from '../../rest/queries/docStoreQuery';
import { resolvePersonaViewMode } from '../../utils/CustomizePage/PersonaPage.utils';
import { useApplicationStore } from '../useApplicationStore';

/**
 * The view `page` opens in for the selected persona. Shares the persona
 * document cache slot with `useCustomPages`, so it adds no request.
 */
export const usePersonaViewMode = (page: ViewModePage) => {
  const { selectedPersona } = useApplicationStore();
  const fqn = personaDocFqn(selectedPersona);

  const { data: doc } = useQuery({
    queryKey: docStoreQueryKey(fqn ?? ''),
    queryFn: docStoreQueryFn(fqn ?? ''),
    enabled: !!fqn,
    retry: false,
    staleTime: PERSONA_DOC_STALE_TIME,
  });

  return resolvePersonaViewMode(doc, selectedPersona?.id, page);
};
