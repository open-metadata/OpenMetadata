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
import { createContext, useContext, useMemo } from 'react';
import {
  AlertFilteringInput,
  AlertType,
} from '../generated/events/api/alertCapabilitiesRequest';
import {
  getSelectionSupport,
  SelectionSupport,
  SourceOfTheCatalog,
} from '../utils/Alerts/AlertSelectionUtil';
import {
  AlertSourceSearch,
  getAlertSourceSearch,
} from '../utils/Alerts/AlertSourceSearch';
import {
  useAlertCapabilities,
  UseAlertCapabilitiesReturn,
} from './useAlertCapabilities';

export interface UseAlertSelectionProps {
  alertType: AlertType;
  sources?: string[];
  input?: AlertFilteringInput;
  /** What the form already knows about each source, used until the server answers. */
  catalog?: SourceOfTheCatalog[];
  quiet?: boolean;
}

export interface AlertSelection {
  sources: string[];
  support: SelectionSupport;
  capabilities: UseAlertCapabilitiesReturn;
  loading: boolean;
  search: AlertSourceSearch;
}

const NO_SOURCES: string[] = [];
const NO_CATALOG: SourceOfTheCatalog[] = [];

/**
 * The sources an alert watches and what they support, asked once for the whole page. The form or
 * view that shows an alert provides it, and every field inside reads it from there, so the source
 * picker, the filters, the triggers and the recipients never disagree about the selection.
 */
export const useAlertSelection = ({
  alertType,
  sources = NO_SOURCES,
  input,
  catalog = NO_CATALOG,
  quiet,
}: UseAlertSelectionProps): AlertSelection => {
  const capabilities = useAlertCapabilities({
    alertType,
    sources,
    input,
    quiet,
  });
  const support = useMemo(
    () => getSelectionSupport(catalog, sources, capabilities.selection),
    [catalog, sources, capabilities.selection]
  );
  const search = useMemo(
    () => getAlertSourceSearch(sources, support.containerEntities),
    [sources, support.containerEntities]
  );

  return useMemo(
    () => ({
      sources,
      support,
      capabilities,
      loading: capabilities.loading,
      search,
    }),
    [sources, support, capabilities, search]
  );
};

const NOTHING_SELECTED: AlertSelection = {
  sources: NO_SOURCES,
  support: {},
  capabilities: { loading: false },
  loading: false,
  search: {
    indexes: [],
    containerEntities: [],
    byName: async () => [],
    byId: async () => [],
  },
};

const AlertSelectionContext = createContext<AlertSelection>(NOTHING_SELECTED);

export const AlertSelectionProvider = AlertSelectionContext.Provider;

export const useAlertSelectionContext = (): AlertSelection =>
  useContext(AlertSelectionContext);
