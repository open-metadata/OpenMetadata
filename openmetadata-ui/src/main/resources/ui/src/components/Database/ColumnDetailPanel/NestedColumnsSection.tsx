/*
 *  Copyright 2025 Collate.
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
import { Box, useTheme } from '@mui/material';
import { Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-new.svg';
import { Column } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getNestedSectionTitle } from '../../../utils/TableUtils';
import { NestedColumnsSectionProps } from './NestedColumnsSection.interface';

const NestedColumnItem: React.FC<{
  column: Column;
  depth: number;
  onColumnClick: (column: Column) => void;
}> = ({ column, depth, onColumnClick }) => {
  const theme = useTheme();
  const hasChildren = column.children && column.children.length > 0;

  return (
    <Box key={column.fullyQualifiedName}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          padding: '4px 0',
          paddingLeft: depth * 2,
          cursor: 'pointer',
          '&:hover .nested-column-name': {
            textDecoration: 'underline',
          },
        }}
        onClick={() => onColumnClick(column)}>
        <ColumnIcon
          style={{
            width: 11,
            height: 11,
            color: theme.palette.allShades?.brand?.[700],
            strokeWidth: '1.2px',
          }}
        />
        <Typography.Link
          className="nested-column-name"
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: theme.palette.allShades?.brand?.[700],
          }}>
          {getEntityName(column)}
        </Typography.Link>
      </Box>
      {hasChildren && (
        <Box sx={{ paddingLeft: 2 }}>
          {column.children!.map((child) => (
            <NestedColumnItem
              column={child}
              depth={depth + 1}
              key={child.fullyQualifiedName}
              onColumnClick={onColumnClick}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export const NestedColumnsSection: React.FC<NestedColumnsSectionProps> = ({
  columns,
  entityType,
  onColumnClick,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (columns.length === 0) {
    return null;
  }

  return (
    <Box
      borderBottom={`0.6px solid ${theme.palette.allShades?.blueGray?.[100]}`}
      padding={4}
      paddingTop={0}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          marginBottom: 3,
        }}>
        <Typography.Text
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.palette.allShades?.gray?.[900],
          }}>
          {t(getNestedSectionTitle(entityType))}
        </Typography.Text>
        <Box
          sx={{
            borderRadius: '6px',
            padding: 0,
            width: '20px',
            display: 'flex',
            textAlign: 'center',
            marginLeft: 1,
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'grey.50',
          }}>
          <Typography.Text
            style={{
              color: theme.palette.allShades?.gray?.[600],
              fontSize: 10,
              fontWeight: 500,
            }}>
            {columns.length}
          </Typography.Text>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {columns.map((column) => (
          <NestedColumnItem
            column={column}
            depth={0}
            key={column.fullyQualifiedName}
            onColumnClick={onColumnClick}
          />
        ))}
      </Box>
    </Box>
  );
};
