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
import { RuleInfo } from '../../../../../../rest/permissionAPI';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getEffectBadgeColor } from './permissions.utils';

export interface PermissionRuleRowProps {
  rule: RuleInfo;
}

const ColumnHeader: React.FC<{ label: string }> = ({ label }) => (
  <Typography
    className="tw:text-quaternary tw:uppercase"
    size="text-xs"
    weight="medium">
    {label}
  </Typography>
);

/** A column of value chips (operations / resources), or a placeholder. */
const ChipColumn: React.FC<{ label: string; values: string[] }> = ({
  label,
  values,
}) => (
  <Box direction="col" gap={2}>
    <ColumnHeader label={label} />
    {values.length === 0 ? (
      <Typography className="tw:text-secondary" size="text-sm">
        --
      </Typography>
    ) : (
      <Box className="tw:flex-wrap tw:gap-1.5">
        {values.map((value) => (
          <Badge key={value} size="sm" type="modern">
            {value}
          </Badge>
        ))}
      </Box>
    )}
  </Box>
);

/**
 * One policy rule laid out as an Operations / Resources / Effect column grid
 * (values rendered as chips), with an optional condition beneath.
 */
const PermissionRuleRow: React.FC<PermissionRuleRowProps> = ({ rule }) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:py-3" direction="col" gap={3}>
      <Box className="tw:grid tw:gap-4 tw:[grid-template-columns:minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,0.8fr)]">
        <ChipColumn
          label={t('label.operation-plural')}
          values={rule.operations}
        />
        <ChipColumn
          label={t('label.resource-plural')}
          values={rule.resources}
        />
        <Box direction="col" gap={2}>
          <ColumnHeader label={t('label.effect')} />
          <Box>
            <Badge color={getEffectBadgeColor(rule.effect)} size="sm">
              {(rule.effect ?? '').toUpperCase()}
            </Badge>
          </Box>
        </Box>
      </Box>
      {rule.condition && (
        <Box direction="col" gap={2}>
          <ColumnHeader label={t('label.condition')} />
          <Box>
            <Badge className="tw:font-mono" size="sm" type="modern">
              {rule.condition}
            </Badge>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PermissionRuleRow;
