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
import { AlertCapabilities } from '../../../generated/events/api/alertCapabilities';

export interface AlertSourcePickerProps {
  /** Names of the sources the catalog offers. */
  sources: string[];
  value?: string[];
  /** The form item has already stored the new selection by the time this runs, so it also gets the one before. */
  onChange?: (sources: string[], previousSources: string[]) => void;
  /** What the server said about the current selection. */
  selection?: AlertCapabilities;
  /** Shows the sources without letting them change, as the alert's view does. */
  isDisabled?: boolean;
}
