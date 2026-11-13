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
import { useTranslation } from 'react-i18next';
import type { OntologyWorkingDiff } from '../../../../generated/api/data/ontologyWorkingDiff';
import { getWorkingChanges } from './OntologyReleasePanel.utils';

interface OntologyReleaseTruncationNoteProps {
  working?: Pick<OntologyWorkingDiff, 'data' | 'groups' | 'paging'>;
}

/**
 * The counts, filters and version suggestion read the first page only, so a
 * response with a next page makes them partial and the reader must be told.
 */
const OntologyReleaseTruncationNote = ({
  working,
}: OntologyReleaseTruncationNoteProps) => {
  const { t } = useTranslation();
  if (!working?.paging.after) {
    return null;
  }
  // A grouped response counts classes in `total`, not changes.
  const total = working.groups ? undefined : working.paging.total;

  return (
    <Typography
      color="secondary"
      data-testid="ontology-changes-truncated"
      role="note"
      size="text-sm">
      {t(
        total === undefined
          ? 'message.ontology-changes-truncated'
          : 'message.ontology-changes-truncated-total',
        { count: getWorkingChanges(working).length, total }
      )}
    </Typography>
  );
};

export default OntologyReleaseTruncationNote;
