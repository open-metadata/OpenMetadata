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

import { Badge, Tooltip } from 'antd';
import classNames from 'classnames';
import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LearningIconSvg } from '../../../assets/svg/ic-learning.svg';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import { LearningDrawer } from '../LearningDrawer/LearningDrawer.component';
import { LearningIconProps } from './LearningIcon.interface';
import './LearningIcon.less';

interface ErrorBoundaryState {
  hasError: boolean;
}

class LearningIconErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('LearningIcon error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

const LearningIconContent: React.FC<LearningIconProps> = ({
  pageId,
  title,
  className = '',
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceCount, setResourceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const fetchResourceCount = useCallback(async () => {
    if (resourceCount > 0 || isLoading || hasError) {
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
  }, [pageId, resourceCount, isLoading, hasError]);

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

  const tooltipTitle = `${resourceCount} ${t('label.resource-plural')} ${t('label.available').toLowerCase()}`;

  return (
    <>
      <Tooltip placement="bottom" title={tooltipTitle}>
        <Badge
          className={classNames('learning-icon-badge', className)}
          count={resourceCount}
          offset={[8, -4]}
          size="small">
          <div
            className="learning-icon-container"
            data-testid={`learning-icon-${pageId}`}
            onClick={handleClick}>
            <LearningIconSvg className="learning-icon-svg" />
          </div>
        </Badge>
      </Tooltip>

      <LearningDrawer
        open={drawerOpen}
        pageId={pageId}
        title={title}
        onClose={handleClose}
      />
    </>
  );
};

export const LearningIcon: React.FC<LearningIconProps> = (props) => {
  return (
    <LearningIconErrorBoundary>
      <LearningIconContent {...props} />
    </LearningIconErrorBoundary>
  );
};
