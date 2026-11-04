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
}

export interface AlertSelection {
  sources: string[];
  support: SelectionSupport;
  capabilities: UseAlertCapabilitiesReturn;
  loading: boolean;
  /**
   * The server has answered the first question, or it failed. A form or view waits for this
   * before it shows anything, and does not go back to waiting afterwards.
   */
  ready: boolean;
  search: AlertSourceSearch;
}

const NO_SOURCES: string[] = [];

const splitKey = (key: string): string[] => (key ? key.split('|') : []);

/**
 * The sources an alert watches and what they support, asked once for the whole page. The form or
 * view that shows an alert provides it, and every field inside reads it from there, so the source
 * picker, the filters, the triggers and the recipients never disagree about the selection.
 */
export const useAlertSelection = ({
  alertType,
  sources = NO_SOURCES,
  input,
}: UseAlertSelectionProps): AlertSelection => {
  const capabilities = useAlertCapabilities({
    alertType,
    sources,
    input,
  });
  const support = useMemo(
    () =>
      getSelectionSupport(
        sources,
        capabilities.selection,
        capabilities.answeredFor
      ),
    [sources, capabilities.selection, capabilities.answeredFor]
  );
  // Every capabilities answer is a new object, even when it says the same thing. The fields that
  // search re-run their initial fetch and cancel a pending typed search whenever `search` changes,
  // so it is keyed by the values it closes over rather than by the arrays that carry them.
  const sourcesKey = sources.join('|');
  const containerEntitiesKey = (support.containerEntities ?? []).join('|');
  const search = useMemo(
    () =>
      getAlertSourceSearch(
        splitKey(sourcesKey),
        splitKey(containerEntitiesKey)
      ),
    [sourcesKey, containerEntitiesKey]
  );

  return useMemo(
    () => ({
      sources,
      support,
      capabilities,
      loading: capabilities.loading,
      ready: capabilities.settled,
      search,
    }),
    [sources, support, capabilities, search]
  );
};

const NOTHING_SELECTED: AlertSelection = {
  sources: NO_SOURCES,
  support: {},
  capabilities: {
    knownSources: [],
    loading: false,
    settled: true,
    retry: () => undefined,
  },
  loading: false,
  ready: true,
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
