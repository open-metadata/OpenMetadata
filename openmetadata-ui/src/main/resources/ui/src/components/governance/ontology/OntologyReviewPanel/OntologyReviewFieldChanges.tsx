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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { diffMemberFields } from './OntologyReviewRelease.utils';

interface OntologyReviewFieldChangesProps {
  before?: unknown;
  after?: unknown;
}

const OntologyReviewFieldChanges = ({
  before,
  after,
}: OntologyReviewFieldChangesProps) => {
  const { t } = useTranslation();
  const changes = useMemo(
    () => diffMemberFields(before, after),
    [before, after]
  );
  const unset = t('label.not-set');

  return (
    <Box data-testid="ontology-review-field-changes" direction="col" gap={2}>
      <Typography as="h4">{t('label.field-plural')}</Typography>
      {changes.length === 0 ? (
        <Typography color="secondary">{t('label.none')}</Typography>
      ) : (
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
          {changes.map((change) => (
            <li data-testid="ontology-review-field-change" key={change.field}>
              <Typography size="text-sm" weight="semibold">
                {change.field}
              </Typography>
              <Typography color="secondary" size="text-sm">
                {t('label.before')}: {change.before ?? unset}
              </Typography>
              <Typography size="text-sm">
                {t('label.after')}: {change.after ?? unset}
              </Typography>
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
};

export default OntologyReviewFieldChanges;
