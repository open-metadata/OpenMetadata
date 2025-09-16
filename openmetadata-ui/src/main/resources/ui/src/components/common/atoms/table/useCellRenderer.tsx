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

import { Avatar, AvatarGroup, Box, Typography, useTheme } from '@mui/material';
import { Cube01, Globe01 } from '@untitledui/icons';
import { ReactNode, useMemo } from 'react';
import { EntityReference } from '../../../../generated/entity/type';
import { getRandomColor } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { CellRenderer, ColumnConfig } from '../shared/types';
import TagsCell from './TagsCell';

const EMPTY_VALUE_INDICATOR = '-';

interface UseCellRendererProps<T> {
  columns: ColumnConfig<T>[];
  renderers?: CellRenderer<T>;
  chipSize?: 'small' | 'large';
}

export const useCellRenderer = <
  T extends { id: string; name?: string; displayName?: string }
>(
  props: UseCellRendererProps<T>
) => {
  const { columns, renderers = {}, chipSize = 'large' } = props;
  const theme = useTheme();

  const defaultRenderers: CellRenderer<T> = useMemo(
    () => ({
      entityName: (entity: any) => {
        const entityName = getEntityName(entity);

        // Generic entity icon (exact copy from useTableRow)
        const getEntityIcon = () => {
          const bgColor =
            entity.style?.color || theme.palette.allShades.brand[600];

          return (
            <Avatar
              alt={entity.name || entity.displayName}
              className="entity-avatar"
              src={entity.style?.iconURL}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: bgColor,
                color: theme.palette.allShades.white,
                '& .MuiAvatar-img': {
                  width: 24,
                  height: 24,
                },
              }}>
              {!entity.style?.iconURL &&
                (entity.entityType === 'dataProduct' ? (
                  <Cube01 size={24} />
                ) : (
                  <Globe01 size={24} />
                ))}
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
      owners: (entity: any, column?: ColumnConfig<T>) => {
        const owners = column?.getValue
          ? column.getValue(entity)
          : entity[column?.key || 'owners'];

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
      tags: (entity: any, column?: ColumnConfig<T>) => {
        const tags = column?.getValue
          ? column.getValue(entity)
          : entity[column?.key || 'tags'];

        if (!tags || tags.length === 0) {
          return (
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
              {EMPTY_VALUE_INDICATOR}
            </Typography>
          );
        }

        return <TagsCell chipSize={chipSize} tags={tags} />;
      },
      text: (entity: T, column?: ColumnConfig<T>) => {
        const value = column?.getValue
          ? column.getValue(entity)
          : (entity as any)[column?.key || ''];

        return (
          <Typography sx={{ fontSize: '0.875rem' }}>
            {value || EMPTY_VALUE_INDICATOR}
          </Typography>
        );
      },
      custom: (entity: T, column?: ColumnConfig<T>) => {
        if (column?.customRenderer && renderers[column.customRenderer]) {
          return renderers[column.customRenderer](entity);
        }

        return (
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {EMPTY_VALUE_INDICATOR}
          </Typography>
        );
      },
    }),
    [renderers, theme, chipSize]
  );

  const renderCell = useMemo(
    () =>
      (entity: T, column: ColumnConfig<T>): ReactNode => {
        const allRenderers = { ...defaultRenderers, ...renderers };
        const renderer = allRenderers[column.render];

        if (renderer) {
          return renderer(entity, column);
        }

        return <span>-</span>;
      },
    [defaultRenderers, renderers]
  );

  return {
    renderCell,
    defaultRenderers,
    allRenderers: { ...defaultRenderers, ...renderers },
  };
};
