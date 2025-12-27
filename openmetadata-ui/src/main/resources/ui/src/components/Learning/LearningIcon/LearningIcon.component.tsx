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

import { BulbOutlined } from '@ant-design/icons';
import { Badge, Button, Tooltip } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import { LearningDrawer } from '../LearningDrawer/LearningDrawer.component';
import { LearningIconProps } from './LearningIcon.interface';
import './LearningIcon.less';

export const LearningIcon: React.FC<LearningIconProps> = ({
  pageId,
  className = '',
  size = 'medium',
  label,
  tooltip,
  placement = 'bottom',
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceCount, setResourceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const sizeMap = {
    small: 'sm',
    medium: 'middle',
    large: 'lg',
  };

  const fetchResourceCount = useCallback(async () => {
    if (resourceCount > 0) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 1,
      });
      setResourceCount(response.paging?.total ?? 0);
    } catch (error) {
      setResourceCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [pageId, resourceCount]);

  const handleClick = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const tooltipTitle = useMemo(
    () =>
      tooltip ||
      (resourceCount > 0
        ? t('label.learning-resources-available', {
            count: resourceCount,
          })
        : t('label.learn-more')),
    [tooltip, resourceCount, t]
  );

  const buttonContent = useMemo(() => {
    if (label) {
      return (
        <>
          <BulbOutlined />
          <span className="m-l-xs">{label}</span>
        </>
      );
    }

    return <BulbOutlined />;
  }, [label]);

  return (
    <>
      <Tooltip placement={placement} title={tooltipTitle}>
        <Badge
          className="learning-icon-badge"
          count={resourceCount}
          offset={[-2, 2]}
          overflowCount={99}
          size="small">
          <Button
            className={`learning-icon ${className}`}
            data-testid={`learning-icon-${pageId}`}
            icon={!label ? <BulbOutlined /> : undefined}
            loading={isLoading}
            size={sizeMap[size]}
            type="text"
            onClick={handleClick}
            onMouseEnter={fetchResourceCount}>
            {label && buttonContent}
          </Button>
        </Badge>
      </Tooltip>

      <LearningDrawer open={drawerOpen} pageId={pageId} onClose={handleClose} />
    </>
  );
};
