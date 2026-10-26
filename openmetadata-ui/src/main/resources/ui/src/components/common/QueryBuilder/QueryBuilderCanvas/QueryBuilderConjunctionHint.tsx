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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueryBuilderConjunctionHintProps } from './QueryBuilderCanvas.types';

// The canvas offers no NOT control, but a rule saved through the API can still negate a group; without this the group
// would read as the opposite of what the workflow runs.
const QueryBuilderConjunctionHint: FC<QueryBuilderConjunctionHintProps> = ({
  conjunction,
  negated,
}) => {
  const { t } = useTranslation();
  const isOr = conjunction === 'OR';
  let hint = isOr
    ? t('message.any-condition-can-match')
    : t('message.all-conditions-must-match');

  if (negated) {
    hint = isOr
      ? t('message.no-condition-can-match')
      : t('message.at-least-one-condition-must-not-match');
  }

  return (
    <Box align="center" gap={2}>
      {negated && (
        <Badge
          color="warning"
          data-testid="query-builder-negated-group"
          size="sm"
          type="pill-color">
          {t('label.not-uppercase')}
        </Badge>
      )}
      <Typography className="tw:text-tertiary" size="text-xs">
        {hint}
      </Typography>
    </Box>
  );
};

export default QueryBuilderConjunctionHint;
