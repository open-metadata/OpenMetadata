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

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Button, useTheme } from '@mui/material';
import { Popover } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LearningIconSvg } from '../../../assets/svg/ic-learning.svg';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import { LearningDrawer } from '../LearningDrawer/LearningDrawer.component';
import { LearningIconProps } from './LearningIcon.interface';

export const LearningIcon: React.FC<LearningIconProps> = ({
  pageId,
  title,
  className = '',
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceCount, setResourceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchResourceCount = useCallback(async () => {
    if (resourceCount > 0 || hasError) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 1,
      });
      setResourceCount(response.paging?.total ?? 0);
    } catch {
      setHasError(true);
      setResourceCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [pageId, resourceCount, hasError]);

  useEffect(() => {
    fetchResourceCount();
  }, []);

  const handleClick = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (hasError || (resourceCount === 0 && !isLoading)) {
    return null;
  }

  const popoverContent = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
      }}>
      <Box
        component="span"
        sx={{
          fontSize: theme.typography.pxToRem(13),
          whiteSpace: 'nowrap',
        }}>
        {t('label.learn-how-this-feature-works')}
      </Box>
      <Button
        endIcon={
          <ArrowForwardIcon
            sx={{ fontSize: theme.typography.body2.fontSize }}
          />
        }
        size="small"
        sx={{
          borderRadius: theme.spacing(1.25),
          border: `0.5px solid ${theme.palette.grey[300]}`,
          background: theme.palette.background.paper,
          boxShadow: theme.shadows[1],
          color: theme.palette.text.secondary,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: theme.typography.fontWeightMedium,
          padding: theme.spacing(0.5, 1.25),
          minWidth: 0,
        }}
        variant="text"
        onClick={handleClick}>
        {resourceCount} {t('label.resource-plural').toLowerCase()}
      </Button>
    </Box>
  );

  return (
    <>
      <Popover
        content={popoverContent}
        overlayInnerStyle={{
          borderRadius: theme.shape.borderRadius,
          background: `linear-gradient(180deg, ${theme.palette.grey[50]} 0%, ${theme.palette.grey[100]} 100%)`,
          boxShadow: theme.shadows[2],
          padding: theme.spacing(0.5, 1.25),
        }}
        placement="bottomLeft"
        showArrow={false}
        trigger="hover">
        <Box
          className={className}
          data-testid="learning-icon"
          sx={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            verticalAlign: 'middle',
            position: 'relative',
            borderRadius: theme.spacing(2),
            backgroundColor: theme.palette.grey[100],
            padding: theme.spacing(0.5),
            height: 'fit-content',
          }}
          onClick={handleClick}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.1)',
              },
            }}>
            <LearningIconSvg height={16} width={16} />
          </Box>
        </Box>
      </Popover>

      <LearningDrawer
        open={drawerOpen}
        pageId={pageId}
        title={title}
        onClose={handleClose}
      />
    </>
  );
};
