/*
 *  Copyright 2022 Collate.
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
  Skeleton,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { noop } from 'lodash';
import { cloneElement, ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../context/LimitsProvider/useLimitsStore';
import { getEntityNameLabel } from '../utils/EntityNameUtils';

interface LimitWrapperProps {
  children: ReactElement;
  resource: string;
}

/**
 * Component that will responsible to limit the action based on limit api response
 * If limit is disabled it simply return the children
 * @param resource -- resource name, required to identify the limits applicable based on name
 * @param children -- children component that need to be wrapped
 * @returns - Wrapped component
 */
const LimitWrapper = ({ resource, children }: LimitWrapperProps) => {
  const { t } = useTranslation();
  const { getResourceLimit, resourceLimit, config, setBannerDetails } =
    useLimitStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (resource && config?.enable) {
      setLoading(true);
      void getResourceLimit(resource)
        .catch(noop)
        .finally(() => isMounted && setLoading(false));
    }

    return () => {
      isMounted = false;
      setBannerDetails(null);
    };
  }, [resource, config?.enable, getResourceLimit, setBannerDetails]);
  const currentLimits = resourceLimit[resource];

  const limitReached = currentLimits?.limitReached;

  // If limit configuration is disabled or current count is -1, then return the children
  if (!config?.enable || currentLimits?.currentCount === -1) {
    return children;
  }

  if (loading) {
    return (
      <div aria-label={t('label.loading')} role="status">
        <Skeleton height={36} variant="rounded" width="100%" />
      </div>
    );
  }

  const resourceLabel =
    {
      dataAssets: t('label.data-asset-plural'),
      dataQuality: t('label.data-quality'),
      eventsubscription: t('label.event-subscription'),
      knowledgeCenter: t('label.context-center'),
    }[resource] ?? getEntityNameLabel(resource);
  const limitMessage = `${t('server.entity-limit-reached', {
    entity: resourceLabel,
  })} (${currentLimits?.currentCount}/${
    currentLimits?.configuredLimit.limits.hardLimit
  })`;
  const disabledActionProps =
    typeof children.type === 'string'
      ? { disabled: true, onClick: noop }
      : {
          disabled: true,
          isDisabled: true,
          onClick: noop,
          onPress: noop,
        };

  return limitReached ? (
    <span className="tw:relative tw:inline-flex">
      {cloneElement(children, {
        ...disabledActionProps,
        className: classNames(children.props.className, 'disabled'),
      })}
      <Tooltip title={limitMessage}>
        <TooltipTrigger
          aria-label={limitMessage}
          className="tw:absolute tw:inset-0 tw:size-full tw:cursor-not-allowed tw:opacity-0"
          data-testid="limit-reached-trigger">
          <span aria-hidden="true" />
        </TooltipTrigger>
      </Tooltip>
    </span>
  ) : (
    children
  );
};

export default LimitWrapper;
