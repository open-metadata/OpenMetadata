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

import { Typography } from '@openmetadata/ui-core-components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetRealization } from '../../../../generated/type/assetRealization';
import { getGlossaryTermsById } from '../../../../rest/glossaryAPI';
import { OntologyConceptRealization } from '../../../OntologyExplorer/OntologyConceptRealization.component';

export interface GlossaryTermRealizedAssetsProps {
  readonly termId?: string;
}

/**
 * Separates the assets that store a concept's instances from the assets that merely carry it as a
 * tag. The realizations are fetched here rather than taken from the page's term, so the section
 * does not depend on which fields that page happened to request.
 */
export const GlossaryTermRealizedAssets: React.FC<
  GlossaryTermRealizedAssetsProps
> = ({ termId }) => {
  const { t } = useTranslation();
  const [realizations, setRealizations] = useState<AssetRealization[]>([]);

  useEffect(() => {
    let active = true;
    setRealizations([]);

    if (!termId) {
      return undefined;
    }

    getGlossaryTermsById(termId, { fields: ['realizedIn'] })
      .then((term) => {
        if (active) {
          setRealizations(term.realizedIn ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setRealizations([]);
        }
      });

    return () => {
      active = false;
    };
  }, [termId]);

  return (
    <div
      className="tw:mb-4 tw:flex tw:flex-col tw:gap-3"
      data-testid="glossary-term-realized-assets">
      <OntologyConceptRealization realizations={realizations} />
      <Typography as="h3" size="text-sm" weight="semibold">
        {t('label.tagged-on')}
      </Typography>
    </div>
  );
};
