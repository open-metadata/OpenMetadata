/*
 *  Copyright 2023 Collate.
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

import {
  Badge,
  Box,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { DIMENSION_COLOR_PALETTE } from '../../../../../../constants/DataQualityDimension.constants';
import {
  DataQualityDimension,
  ProviderType,
} from '../../../../../../generated/tests/dataQualityDimension';

const isSystemDimension = (dimension: DataQualityDimension) =>
  dimension.provider === ProviderType.System;

export const DimensionNameCell = ({
  dimension,
}: {
  dimension: DataQualityDimension;
}) => (
  <Box align="start" direction="row" gap={2}>
    <span
      className="tw:mt-1.5 tw:size-2.5 tw:shrink-0 tw:rounded-full"
      style={{
        backgroundColor: dimension.style?.color ?? DIMENSION_COLOR_PALETTE[0],
      }}
    />
    <Box direction="col">
      <Typography size="text-sm" weight="semibold">
        {dimension.displayName ?? dimension.name}
      </Typography>
      <Typography className="tw:text-tertiary" size="text-xs">
        {dimension.name}
      </Typography>
    </Box>
  </Box>
);

export const DimensionTypeCell = ({
  dimension,
}: {
  dimension: DataQualityDimension;
}) => {
  const { t } = useTranslation();
  const isSystem = isSystemDimension(dimension);

  return (
    <Badge color={isSystem ? 'gray' : 'blue'} size="sm" type="color">
      {isSystem ? t('label.system') : t('label.custom')}
    </Badge>
  );
};

interface DimensionActionsCellProps {
  dimension: DataQualityDimension;
  onEdit: (dimension: DataQualityDimension) => void;
  onDelete: (dimension: DataQualityDimension) => void;
}

/** System dimensions ship with the platform and are read-only. */
export const DimensionActionsCell = ({
  dimension,
  onEdit,
  onDelete,
}: DimensionActionsCellProps) => {
  const { t } = useTranslation();
  const isSystem = isSystemDimension(dimension);
  const lockedTooltip = t('message.system-dimensions-are-read-only');
  const entity = t('label.dimension');

  return (
    <Box direction="row" gap={1}>
      <ButtonUtility
        color="tertiary"
        data-testid={`edit-${dimension.name}`}
        icon={Edit01}
        isDisabled={isSystem}
        size="xs"
        tooltip={isSystem ? lockedTooltip : t('label.edit-entity', { entity })}
        onPress={() => onEdit(dimension)}
      />
      <ButtonUtility
        color="tertiary"
        data-testid={`delete-${dimension.name}`}
        icon={Trash01}
        isDisabled={isSystem}
        size="xs"
        tooltip={
          isSystem ? lockedTooltip : t('label.delete-entity', { entity })
        }
        onPress={() => onDelete(dimension)}
      />
    </Box>
  );
};
