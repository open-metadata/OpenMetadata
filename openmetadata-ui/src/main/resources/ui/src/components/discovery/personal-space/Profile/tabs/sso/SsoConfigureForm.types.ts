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

import type { SecurityConfiguration } from '../../../../../../rest/securityConfigAPI';

/** RJSF `formContext` the SSO templates and fields read. */
export interface SsoFormContext {
  /** Doc markdown keyed by doc section id (see `FIELD_MAPPINGS`). */
  fieldDocs?: Record<string, string>;
  clearFieldError?: (fieldPath: string) => void;
  currentProvider?: string;
  handleFocus?: (id: string) => void;
}

export interface SsoConfigureFormProps {
  /** Saved configuration to edit; omit when setting up `selectedProvider`. */
  securityConfig?: SecurityConfiguration;
  /** Provider for a new configuration. */
  selectedProvider?: string;
  showHint: boolean;
  /** Leaves a new setup (cancel/discard) — back to the provider grid. */
  onChangeProvider: () => void;
}
