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
  Box,
  Button,
  Popover,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@untitledui/icons';
import classNames from 'classnames';
import React, { lazy, useCallback, useEffect, useRef, useState } from 'react';
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
  ),
  null
);

export const LearningIcon: React.FC<LearningIconProps> = ({
  pageId,
  title,
  className = '',
}) => {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
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

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearCloseTimeout, [clearCloseTimeout]);

  const openPopover = useCallback(() => {
    clearCloseTimeout();
    setPopoverOpen(true);
  }, [clearCloseTimeout]);

  const closePopover = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setPopoverOpen(false), 120);
  }, []);

  const handleClick = useCallback(() => {
    setDrawerOpen(true);
    setPopoverOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (hasError || (resourceCount === 0 && !isLoading)) {
    return null;
  }

  return (
    <>
      <button
        aria-label={t('label.learn-how-this-feature-works')}
        className={classNames(
          'tw:inline-flex tw:items-center tw:align-middle tw:cursor-pointer tw:text-brand-600 tw:border-0 tw:bg-transparent tw:p-0',
          className
        )}
        data-testid="learning-icon"
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}>
        <LearningIconSvg height={16} width={16} />
      </button>

      <Popover
        isNonModal
        containerClassName="tw:px-3 tw:py-2"
        isOpen={popoverOpen}
        placement="bottom left"
        triggerRef={triggerRef}
        onOpenChange={setPopoverOpen}>
        <Box
          align="center"
          gap={2}
          onMouseEnter={openPopover}
          onMouseLeave={closePopover}>
          <Typography as="span" size="text-sm">
            {t('label.learn-how-this-feature-works')}
          </Typography>
          <Button
            color="tertiary"
            data-testid="learning-resources-button"
            iconTrailing={<ArrowRight size={14} />}
            size="sm"
            onPress={handleClick}>
            {resourceCount} {t('label.resource-plural').toLowerCase()}
          </Button>
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
