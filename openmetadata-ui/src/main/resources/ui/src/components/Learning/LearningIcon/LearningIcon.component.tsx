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

import { Box, Button } from '@mui/material';
import { ArrowRight } from '@untitledui/icons';
import { Popover } from 'antd';
import React, { lazy, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LearningIconSvg } from '../../../assets/svg/ic-learning.svg';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { LearningIconProps } from './LearningIcon.interface';

const LearningDrawer = withSuspenseFallback(
  lazy(() =>
    import('../LearningDrawer/LearningDrawer.component').then((m) => ({
      default: m.LearningDrawer,
    }))
  )
);

export const LearningIcon: React.FC<LearningIconProps> = ({
  pageId,
  title,
  className = '',
}) => {
  const { t } = useTranslation();
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
        gap: '4px',
      }}>
      <Box
        component="span"
        sx={{
          fontSize: '0.8125rem',
          whiteSpace: 'nowrap',
        }}>
        {t('label.learn-how-this-feature-works')}
      </Box>
      <Button
        endIcon={<ArrowRight size={14} />}
        size="small"
        sx={{
          borderRadius: '5px',
          border: `0.5px solid var(--color-border-primary)`,
          background: 'var(--color-bg-primary)',
          boxShadow: 'var(--shadow-xs)',
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
          fontWeight: 500,
          padding: '2px 5px',
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
          borderRadius: '8px',
          background: `linear-gradient(180deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%)`,
          boxShadow: 'var(--shadow-sm)',
          padding: '2px 5px',
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
            borderRadius: '8px',
            backgroundColor: 'rgba(83, 177, 253, 0.1)',
            padding: '2px',
            height: 'fit-content',
            color: 'var(--color-bg-brand-solid)',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(83, 177, 253, 0.2)',
            },
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
