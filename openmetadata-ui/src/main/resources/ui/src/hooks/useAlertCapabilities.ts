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
import { isEqual, uniq } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCapabilities,
  AlertSourceCapability,
} from '../generated/events/api/alertCapabilities';
import {
  AlertFilteringInput,
  AlertType,
} from '../generated/events/api/alertCapabilitiesRequest';
import { getAlertCapabilities } from '../rest/alertsAPI';

export interface UseAlertCapabilitiesProps {
  alertType: AlertType;
  sources?: string[];
  input?: AlertFilteringInput;
}

export interface UseAlertCapabilitiesReturn {
  /** What the current selection supports, and which sources can still join it. */
  selection?: AlertCapabilities;
  /** The sources the answer on screen was given for, which can lag behind the selection. */
  answeredFor?: string[];
  /**
   * Every source of the alert type, by name and kind, from the last answer that arrived. A later
   * question that fails leaves it in place, so the source picker keeps something to offer.
   */
  knownSources: AlertSourceCapability[];
  loading: boolean;
  /** The first question has had its answer, or has failed. It never goes back. */
  settled: boolean;
  /** Asks the current question again, after it failed. The source picker offers it. */
  retry: () => void;
}

interface Shown {
  selection?: AlertCapabilities;
  answeredFor?: string[];
  knownSources: AlertSourceCapability[];
}

const keyOf = (
  alertType: AlertType,
  sources: string[],
  input?: AlertFilteringInput
) => JSON.stringify([alertType, [...sources].sort(), input ?? {}]);

const NOTHING_SHOWN: Shown = { knownSources: [] };

const show =
  (selection: AlertCapabilities | undefined, answeredFor: string[]) =>
  (previous: Shown): Shown => ({
    selection,
    answeredFor: selection ? answeredFor : undefined,
    knownSources: selection
      ? selection.sources.map(({ name, kind }) => ({ name, kind }))
      : previous.knownSources,
  });

/**
 * Asks the server what a selection of sources supports. The rules for combining sources live on
 * the server, where the save applies them too, so the form never decides them itself. It asks
 * once per distinct selection, the empty one included, since that one lists every source and who
 * alerts can be sent to before any source is chosen. While it asks, the previous answer stays, so
 * what the form offers does not blink. A question that fails is reported by the source picker,
 * which every alert form and view shows, with a way to ask again.
 */
export const useAlertCapabilities = ({
  alertType,
  sources = [],
  input,
}: UseAlertCapabilitiesProps): UseAlertCapabilitiesReturn => {
  const [shown, setShown] = useState<Shown>(NOTHING_SHOWN);
  // It asks as soon as it mounts, so it starts out asking.
  const [loading, setLoading] = useState(true);
  const [settled, setSettled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const answered = useRef<Record<string, AlertCapabilities>>({});
  const latestKey = useRef<string>();
  // Callers often hand over a new array on every render. The names in it are what matters.
  const selectedNames = uniq(sources).join('\n');
  const selected = useMemo(
    () => (selectedNames ? selectedNames.split('\n') : []),
    [selectedNames]
  );
  const lastInput = useRef<AlertFilteringInput | undefined>(input);
  if (!isEqual(lastInput.current, input)) {
    lastInput.current = input;
  }
  const stableInput = lastInput.current;

  const ask = useCallback(
    async (names: string[], chosen?: AlertFilteringInput) => {
      try {
        return await getAlertCapabilities({
          alertType,
          sources: names,
          input: chosen,
        });
      } catch {
        return undefined;
      }
    },
    [alertType]
  );

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    const key = keyOf(alertType, selected, stableInput);
    latestKey.current = key;
    if (answered.current[key]) {
      setShown(show(answered.current[key], selected));
      setLoading(false);
      setSettled(true);

      return;
    }
    setLoading(true);
    ask(selected, stableInput).then((capabilities) => {
      if (capabilities) {
        answered.current[key] = capabilities;
      }
      // An answer to a selection the user has already changed is kept, but not shown.
      if (latestKey.current === key) {
        setShown(show(capabilities, selected));
        setLoading(false);
        setSettled(true);
      }
    });
  }, [alertType, selected, stableInput, ask, attempt]);

  return useMemo(
    () => ({ ...shown, loading, settled, retry }),
    [shown, loading, settled, retry]
  );
};
