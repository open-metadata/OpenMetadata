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

import { Box, Button, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Plus } from '@untitledui/icons';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LearningIcon } from '../../../Learning/LearningIcon/LearningIcon.component';

interface PageHeaderConfig {
  titleKey: string;
  descriptionMessageKey: string;
  actions?: ReactNode;
  createPermission?: boolean;
  addButtonLabelKey?: string;
  addButtonTestId?: string;
  onAddClick?: () => void;
  learningPageId?: string;
}

export const usePageHeader = (config: PageHeaderConfig) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const displayTitle = t(config.titleKey);
  const displayDescription = t(config.descriptionMessageKey);
  const displayButtonLabel = config.addButtonLabelKey
    ? t(config.addButtonLabelKey)
    : '';

  // Inline implementation copying exact EntityPageHeader styling
  const pageHeader = useMemo(
    () => (
      <Paper
        sx={{
          p: 5,
          mb: 5,
          boxShadow: 'none',
          border: `1px solid ${theme.palette.allShades?.blueGray?.[100]}`,
          borderRadius: 1.5,
        }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  color: 'text.primary',
                  mb: 0.5,
                }}
                variant="h4">
                {displayTitle}
              </Typography>
              {config.learningPageId && (
                <LearningIcon pageId={config.learningPageId} />
              )}
            </Box>
            {displayDescription && (
              <Typography
                sx={{ color: 'text.secondary', fontSize: '0.875rem' }}
                variant="body2">
                {displayDescription}
              </Typography>
            )}
          </Box>
          {config.actions ||
            (config.createPermission &&
              config.addButtonLabelKey &&
              config.onAddClick && (
                <Button
                  color="primary"
                  data-testid={config.addButtonTestId || 'add-entity-button'}
                  startIcon={<Plus size={16} />}
                  variant="contained"
                  onClick={config.onAddClick}>
                  {displayButtonLabel}
                </Button>
              ))}
        </Box>
      </Paper>
    ),
    [displayTitle, displayDescription, displayButtonLabel, config, theme]
  );

  return { pageHeader };
};
