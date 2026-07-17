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
import { InternalAxiosRequestConfig } from 'axios';
import i18next from 'i18next';

export const LANGUAGE_HEADER = 'X-OpenMetadata-Language';

/**
 * Stamps the user's currently selected UI language (BCP-47, e.g. `fr-FR`) onto every outgoing
 * request as the `X-OpenMetadata-Language` header. Downstream (Collate server -> AI Platform) this
 * pins the agent's response language deterministically instead of letting it infer one.
 */
export const withLanguageHeader = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  // Use i18next.language (the selected UI language, e.g. 'fr-FR'), NOT resolvedLanguage — the latter
  // can sit at the fallback ('en-US') even when a non-fallback language is active. This matches the
  // NavBar language switcher, which reads i18next.language as the source of truth.
  const language = i18next.language;

  if (language) {
    config.headers[LANGUAGE_HEADER] = language;
  }

  return config;
};
