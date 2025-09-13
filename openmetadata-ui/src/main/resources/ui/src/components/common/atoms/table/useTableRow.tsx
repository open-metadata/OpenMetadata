/*
 *  Copyright 2024 Collate.
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
  Avatar,
  AvatarGroup,
  Box,
  Checkbox,
  Chip,
  Stack,
  TableCell,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { useMemo } from 'react';
import { EntityReference } from '../../../../generated/entity/type';
import { getRandomColor } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';

const EMPTY_VALUE_INDICATOR = '-';

interface EntityColumnConfig {
  key: string;
  labelKey: string;
  render: string;
  customRenderer?: string;
  getValue?: (entity: any) => any;
}

interface TableRowConfig<T> {
  entity: T & { id: string; description?: string; style?: any };
  columns: EntityColumnConfig[];
  renderers: Record<string, any>;
  isSelected: boolean;
  onSelect: (entityId: string, checked: boolean) => void;
  onEntityClick: (entity: T) => void;
  enableSelection?: boolean;
}

export const useTableRow = <
  T extends { id: string; description?: string; style?: any }
>(
  config: TableRowConfig<T>
) => {
  const theme = useTheme();

  // Built-in renderers - inline implementation
  const builtInRenderers = useMemo(
    () => ({
      text: (entity: any, column: EntityColumnConfig) => {
        const value = column.getValue
          ? column.getValue(entity)
          : entity[column.key];

        return (
          <Typography sx={{ fontSize: '0.875rem' }}>{value || '-'}</Typography>
        );
      },

      entityName: (entity: any) => {
        const entityName = getEntityName(entity);

        // Generic entity icon
        const getEntityIcon = () => {
          if (entity.style?.iconURL) {
            return (
              <Avatar
                src={entity.style.iconURL}
                sx={{ width: 40, height: 40 }}
              />
            );
          }

          const bgColor =
            entity.style?.color || theme.palette.allShades.brand[600];

          return (
            <Avatar
              sx={{
                width: 40,
                height: 40,
                backgroundColor: bgColor,
                color: theme.palette.allShades.white,
              }}>
              {entityName[0]?.toUpperCase()}
            </Avatar>
          );
        };

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {getEntityIcon()}
            <Box>
              <Typography
                sx={{
                  fontWeight: 500,
                  color: 'text.primary',
                  fontSize: '0.875rem',
                  lineHeight: '20px',
                }}>
                {entityName}
              </Typography>
              <Typography
                sx={{
                  color: theme.palette.allShades.gray[500],
                  fontSize: '0.75rem',
                  lineHeight: '18px',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                {entity.description || ''}
              </Typography>
            </Box>
          </Box>
        );
      },

      owners: (entity: any, column: EntityColumnConfig) => {
        const owners = column.getValue
          ? column.getValue(entity)
          : entity[column.key];

        if (!owners || owners.length === 0) {
          return (
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
              {EMPTY_VALUE_INDICATOR}
            </Typography>
          );
        }

        const getOwnerAvatar = (owner: EntityReference, size = 24) => {
          const { color, backgroundColor } = getRandomColor(
            owner.displayName || owner.name || ''
          );

          return (
            <Avatar
              sx={{
                width: size,
                height: size,
                backgroundColor,
                color,
                fontSize: size <= 16 ? '0.75rem' : '0.875rem',
              }}>
              {(owner.displayName || owner.name || '?')[0]}
            </Avatar>
          );
        };

        if (owners.length === 1) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getOwnerAvatar(owners[0], 16)}
              <Typography sx={{ fontSize: '0.875rem' }}>
                {owners[0].displayName || owners[0].name}
              </Typography>
            </Box>
          );
        }

        return (
          <Box sx={{ display: 'flex', alignItems: 'left' }}>
            <AvatarGroup
              max={5}
              sx={{
                '& .MuiAvatar-root': {
                  width: 24,
                  height: 24,
                  fontSize: '0.75rem',
                },
              }}>
              {owners.map((owner: EntityReference, index: number) =>
                getOwnerAvatar(owner, 24)
              )}
            </AvatarGroup>
          </Box>
        );
      },

      tags: (entity: any, column: EntityColumnConfig) => {
        const tags = column.getValue
          ? column.getValue(entity)
          : entity[column.key];

        if (!tags || tags.length === 0) {
          return (
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
              {EMPTY_VALUE_INDICATOR}
            </Typography>
          );
        }

        return (
          <Stack direction="row" spacing={1}>
            {tags.slice(0, 2).map((tag: any, index: number) => (
              <Chip
                key={index}
                label={tag.name || tag.tagFQN}
                size="large"
                variant="blueGray"
              />
            ))}
          </Stack>
        );
      },
    }),
    [theme]
  );

  const renderCell = (column: EntityColumnConfig) => {
    // Check for custom renderer first
    if (
      column.render === 'custom' &&
      column.customRenderer &&
      config.renderers[column.customRenderer]
    ) {
      const value = column.getValue
        ? column.getValue(config.entity)
        : config.entity[column.key as keyof T];

      return config.renderers[column.customRenderer](config.entity, value);
    }

    // Use built-in renderer
    const builtInRenderer =
      builtInRenderers[column.render as keyof typeof builtInRenderers];
    if (builtInRenderer) {
      return builtInRenderer(config.entity, column);
    }

    // Fallback to raw value
    const value = column.getValue
      ? column.getValue(config.entity)
      : config.entity[column.key as keyof T];

    return String(value || '-');
  };

  const tableRow = useMemo(
    () => (
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          '&:hover': {
            backgroundColor:
              theme.palette.allShades?.gray?.[50] || 'rgba(0,0,0,0.02)',
          },
        }}
        onClick={() => config.onEntityClick(config.entity)}>
        {config.enableSelection && (
          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={config.isSelected}
              size="medium"
              onChange={(e) =>
                config.onSelect(config.entity.id, e.target.checked)
              }
            />
          </TableCell>
        )}

        {config.columns.map((column) => (
          <TableCell key={column.key}>{renderCell(column)}</TableCell>
        ))}
      </TableRow>
    ),
    [config, theme, builtInRenderers]
  );

  return { tableRow };
};
