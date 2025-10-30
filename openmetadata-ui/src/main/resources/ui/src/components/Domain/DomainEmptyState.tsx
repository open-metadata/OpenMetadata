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
import AddIcon from '@mui/icons-material/Add';
import { Box } from '@mui/material';
import { Button, Typography } from 'antd';
import React, { ReactElement, ReactNode } from 'react';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';

type DomainEmptyStateProps = {
  icon: ReactElement;
  message: ReactNode;
  showCreate?: boolean;
  createLabel?: string;
  onCreate?: () => void;
  className?: string;
  testId?: string;
  contentMaxWidth?: string;
};

const DomainEmptyState: React.FC<DomainEmptyStateProps> = ({
  icon,
  message,
  onCreate,
  contentMaxWidth,
  showCreate = false,
  createLabel = 'Add',
  className = 'p-lg border-none',
  testId = 'add-button',
}) => {
  return (
    <ErrorPlaceHolder
      className={className}
      icon={icon}
      permission={showCreate}
      type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          maxWidth: contentMaxWidth ?? '15rem',
        }}>
        <Typography.Paragraph>{message}</Typography.Paragraph>

        {showCreate && (
          <Button
            data-testid={testId}
            style={{ width: 'max-content', paddingLeft: '12px' }}
            type="primary"
            onClick={onCreate}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AddIcon /> {createLabel}
            </Box>
          </Button>
        )}
      </Box>
    </ErrorPlaceHolder>
  );
};

export default DomainEmptyState;
