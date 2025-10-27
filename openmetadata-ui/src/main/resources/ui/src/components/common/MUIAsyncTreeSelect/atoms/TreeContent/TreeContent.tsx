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

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, CircularProgress, Typography } from '@mui/material';
import { SimpleTreeView, SimpleTreeViewProps } from '@mui/x-tree-view';
import React, { FC, memo, MutableRefObject, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface TreeContentProps {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  children: ReactNode;
  selectedItems?: string | null;
  expandedItems?: string[];
  focusedItem?: string;
  apiRef?: MutableRefObject<any>;
  loadingMessage?: string;
  noDataMessage?: string;
  onNodeToggle?: SimpleTreeViewProps<boolean>['onExpandedItemsChange'];
  onFocusedItemChange?: (event: React.SyntheticEvent, itemId: string) => void;
  onItemClick?: (event: React.MouseEvent, itemId: string) => void;
}

const TreeContent: FC<TreeContentProps> = ({
  loading,
  error,
  hasData,
  children,
  selectedItems = null,
  expandedItems,
  focusedItem,
  apiRef,
  loadingMessage,
  noDataMessage,
  onNodeToggle,
  onFocusedItemChange,
  onItemClick,
}) => {
  const { t } = useTranslation();

  if (loading && !hasData) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 2,
        }}>
        <CircularProgress size={20} />
        <Typography sx={{ ml: 1 }} variant="body2">
          {loadingMessage || t('label.loading')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ p: 2 }} variant="body2">
        {error}
      </Typography>
    );
  }

  if (!hasData) {
    return (
      <Typography sx={{ p: 2, color: 'text.secondary' }} variant="body2">
        {noDataMessage || t('message.no-data-available')}
      </Typography>
    );
  }

  return (
    <SimpleTreeView
      apiRef={apiRef}
      expandedItems={expandedItems}
      focusedItem={focusedItem}
      selectedItems={selectedItems}
      slots={{
        collapseIcon: ExpandMoreIcon,
        expandIcon: ChevronRightIcon,
      }}
      sx={{
        px: 1,
        py: 0.5,
        '& .MuiTreeItem-content': {
          py: 0.25,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          '&:focus': {
            outline: 'none',
          },
          '&.Mui-focused': {
            backgroundColor: 'transparent',
          },
          '&.Mui-selected': {
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          },
        },
        '& .MuiTreeItem-root': {
          '&:focus': {
            outline: 'none',
          },
        },
        '& .MuiTreeItem-label': {
          fontSize: '0.875rem',
          py: 0.5,
        },
        '& .MuiTreeItem-iconContainer': {
          width: 20,
        },
      }}
      onExpandedItemsChange={onNodeToggle}
      onFocusedItemChange={onFocusedItemChange}
      onItemClick={onItemClick}>
      {children}
    </SimpleTreeView>
  );
};

export default memo(TreeContent);
