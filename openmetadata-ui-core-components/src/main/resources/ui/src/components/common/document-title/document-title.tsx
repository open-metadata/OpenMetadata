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

/**
 * Sets the browser tab title via react-helmet-async, appending the brand name
 * (` | {brand}`) to match the rest of the app.
 *
 * `label.brand-name` is resolved from the host app's default i18n namespace, not
 * the library's `core` namespace — the app owns the key and its `{{brandName}}`
 * value (sourced from the `BRAND_NAME` env var via i18next `defaultVariables`),
 * and the shared i18next instance carries that value into the library. The
 * suffix is appended only when the host resolves a real value.
 *
 * Requires a `HelmetProvider` above this component (the OpenMetadata shell wraps
 * its root in one).
 */
export const DocumentTitle = ({ title }: DocumentTitleProps) => {
  const { t } = useTranslation();

  const brand = t('label.brand-name');
  const hasBrand = brand !== 'label.brand-name' && !brand.includes('{{');
  const fullTitle = hasBrand ? `${title} | ${brand}` : title;

  return (
    <Helmet>
      <title>{fullTitle}</title>
    </Helmet>
  );
};

DocumentTitle.displayName = 'DocumentTitle';
