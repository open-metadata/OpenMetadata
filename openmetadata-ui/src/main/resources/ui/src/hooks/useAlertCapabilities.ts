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
import { isEqual, uniq } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCapabilities } from '../generated/events/api/alertCapabilities';
import {
  AlertFilteringInput,
  AlertType,
} from '../generated/events/api/alertCapabilitiesRequest';
import { getAlertCapabilities } from '../rest/alertsAPI';
import { showErrorToast } from '../utils/ToastUtils';

export interface UseAlertCapabilitiesProps {
  alertType: AlertType;
  sources?: string[];
  input?: AlertFilteringInput;
}

export interface UseAlertCapabilitiesReturn {
  /** What the current selection supports, and which sources can still join it. */
  selection?: AlertCapabilities;
  loading: boolean;
}

const keyOf = (sources: string[], input?: AlertFilteringInput) =>
  JSON.stringify([[...sources].sort(), input ?? {}]);

/**
 * Asks the server what a selection of sources supports. The rules for combining sources live on
 * the server, where the save applies them too, so the form never decides them itself. It asks
 * once per distinct selection. With nothing selected there is nothing to ask: every source the
 * catalog lists can be chosen.
 */
export const useAlertCapabilities = ({
  alertType,
  sources = [],
  input,
}: UseAlertCapabilitiesProps): UseAlertCapabilitiesReturn => {
  const [selection, setSelection] = useState<AlertCapabilities>();
  const [loading, setLoading] = useState(false);
  const answered = useRef<Record<string, AlertCapabilities>>({});
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
      } catch (error) {
        showErrorToast(error as AxiosError);

        return undefined;
      }
    },
    [alertType]
  );

  useEffect(() => {
    const key = keyOf(selected, stableInput);
    if (selected.length === 0 || answered.current[key]) {
      setSelection(answered.current[key]);

      return;
    }
    // What was said about another selection says nothing about this one.
    setSelection(undefined);
    setLoading(true);
    ask(selected, stableInput).then((capabilities) => {
      if (capabilities) {
        answered.current[key] = capabilities;
      }
      setSelection(capabilities);
      setLoading(false);
    });
  }, [selected, stableInput, ask]);

  return { selection, loading };
};
