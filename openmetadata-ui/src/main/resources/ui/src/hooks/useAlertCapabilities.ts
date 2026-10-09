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
  /** Says nothing when the server cannot answer, for a view that only shows the alert. */
  quiet?: boolean;
}

export interface UseAlertCapabilitiesReturn {
  /** What the current selection supports, and which sources can still join it. */
  selection?: AlertCapabilities;
  loading: boolean;
}

const keyOf = (
  alertType: AlertType,
  sources: string[],
  input?: AlertFilteringInput
) => JSON.stringify([alertType, [...sources].sort(), input ?? {}]);

/**
 * Asks the server what a selection of sources supports. The rules for combining sources live on
 * the server, where the save applies them too, so the form never decides them itself. It asks
 * once per distinct selection, the empty one included, since that one says who alerts can be
 * sent to before any source is chosen. While it asks, the previous answer stays, so what the form
 * offers does not blink.
 */
export const useAlertCapabilities = ({
  alertType,
  sources = [],
  input,
  quiet = false,
}: UseAlertCapabilitiesProps): UseAlertCapabilitiesReturn => {
  const [selection, setSelection] = useState<AlertCapabilities>();
  const [loading, setLoading] = useState(false);
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
      } catch (error) {
        if (!quiet) {
          showErrorToast(error as AxiosError);
        }

        return undefined;
      }
    },
    [alertType, quiet]
  );

  useEffect(() => {
    const key = keyOf(alertType, selected, stableInput);
    latestKey.current = key;
    if (answered.current[key]) {
      setSelection(answered.current[key]);
      setLoading(false);

      return;
    }
    setLoading(true);
    ask(selected, stableInput).then((capabilities) => {
      if (capabilities) {
        answered.current[key] = capabilities;
      }
      // An answer to a selection the user has already changed is kept, but not shown.
      if (latestKey.current === key) {
        setSelection(capabilities);
        setLoading(false);
      }
    });
  }, [alertType, selected, stableInput, ask]);

  return useMemo(() => ({ selection, loading }), [selection, loading]);
};
