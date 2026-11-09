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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import type {
  SkipGroup,
  SkippedStatements,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import { NATIVE_IMPORT_SKIP_REASON_LABEL_KEYS } from './OntologyNativeImportPanel.utils';

const SkipGroupRow = ({ group }: { readonly group: SkipGroup }) => {
  const { t } = useTranslation();
  const what = [group.predicate, group.object].filter(Boolean).join(' ');

  return (
    <li className="tw:flex tw:flex-col tw:gap-1 tw:py-2">
      <Box align="center" gap={2}>
        <Badge color="gray">
          {t(NATIVE_IMPORT_SKIP_REASON_LABEL_KEYS[group.reason])}
        </Badge>
        <Typography size="text-xs" weight="semibold">
          {group.count}
        </Typography>
        {what && (
          <Typography className="tw:break-all" size="text-xs">
            {what}
          </Typography>
        )}
      </Box>
      {group.subjects && group.subjects.length > 0 && (
        <Typography
          className="tw:break-all tw:font-mono"
          color="secondary"
          size="text-xs">
          {group.subjects.join(', ')}
        </Typography>
      )}
    </li>
  );
};

const OntologyNativeImportSkipped = ({
  skipped,
}: {
  readonly skipped: SkippedStatements;
}) => {
  const { t } = useTranslation();

  return (
    <details
      className="tw:group tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
      data-testid="ontology-native-import-skipped">
      <summary className="tw:flex tw:cursor-pointer tw:list-none tw:items-center tw:gap-2 tw:bg-secondary_alt tw:px-4 tw:py-3">
        <ChevronDown
          aria-hidden="true"
          className="tw:size-4 tw:shrink-0 tw:-rotate-90 tw:group-open:rotate-0"
        />
        <Typography as="span" size="text-sm" weight="semibold">
          {t('message.native-import-skipped-statements', {
            count: skipped.total,
          })}
        </Typography>
      </summary>
      <Box className="tw:p-4" direction="col" gap={2}>
        <Typography color="secondary" size="text-sm">
          {t('message.native-import-skipped-hint')}
        </Typography>
        <ul className="tw:divide-y tw:divide-secondary">
          {skipped.groups.map((group) => (
            <SkipGroupRow
              group={group}
              key={`${group.reason}|${group.predicate}|${group.object}`}
            />
          ))}
        </ul>
        {skipped.omittedGroups > 0 && (
          <Typography color="secondary" size="text-xs">
            {t('message.native-import-skipped-more-groups', {
              count: skipped.omittedGroups,
            })}
          </Typography>
        )}
      </Box>
    </details>
  );
};

export default OntologyNativeImportSkipped;
