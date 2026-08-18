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
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import type { DocumentTitleProps } from './document-title.types';

export type { DocumentTitleProps } from './document-title.types';

/**
 * Sets the browser tab title via react-helmet-async, appending the brand name
 * (` | {brand}`) to match the rest of the app. The consuming app must provide
 * a `HelmetProvider` (the OpenMetadata shell wraps its root in one).
 */
export const DocumentTitle = ({ title }: DocumentTitleProps) => {
  const { t } = useCoreTranslation();

  return (
    <Helmet>
      <title>{`${title} | ${t('label.brand-name')}`}</title>
    </Helmet>
  );
};

DocumentTitle.displayName = 'DocumentTitle';
