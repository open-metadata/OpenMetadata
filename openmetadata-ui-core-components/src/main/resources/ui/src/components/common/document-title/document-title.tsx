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
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import type { DocumentTitleProps } from './document-title.types';

export type { DocumentTitleProps } from './document-title.types';

// Resolved from the host app's default i18n namespace (not the library's `core`
// namespace) — the brand name and its `{{brandName}}` interpolation variable are
// owned by the consuming app, exactly as the app's own DocumentTitle does. Kept
// in a const so the library's core-key check doesn't treat it as a `core` key.
const BRAND_NAME_KEY = 'label.brand-name';

/**
 * Sets the browser tab title via react-helmet-async, appending the brand name
 * (` | {brand}`) to match the rest of the app.
 *
 * Prerequisites on the consuming app: a `HelmetProvider` above this component
 * (the OpenMetadata shell wraps its root in one) and a `label.brand-name` key in
 * the default i18n namespace with a `brandName` interpolation variable (the app
 * sets both). When the host resolves neither, the suffix is omitted.
 */
export const DocumentTitle = ({ title }: DocumentTitleProps) => {
  const { t } = useTranslation();

  const brand = t(BRAND_NAME_KEY);
  // Append the brand only when the host actually resolved it — otherwise the key
  // echoes back (namespace missing) or a raw `{{brandName}}` token remains.
  const hasBrand = brand !== BRAND_NAME_KEY && !brand.includes('{{');
  const fullTitle = hasBrand ? `${title} | ${brand}` : title;

  return (
    <Helmet>
      <title>{fullTitle}</title>
    </Helmet>
  );
};

DocumentTitle.displayName = 'DocumentTitle';
