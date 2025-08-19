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

import { Skeleton } from 'antd';
import classNames from 'classnames';
import { noop } from 'lodash';
import { cloneElement, ReactElement, useEffect, useState } from 'react';
import { Tooltip } from '../components/common/AntdCompat';
import { useLimitStore } from '../context/LimitsProvider/useLimitsStore';
;

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
  const { getResourceLimit, resourceLimit, config, setBannerDetails } =
    useLimitStore();
  const [loading, setLoading] = useState(true);

  const initResourceLimit = async () => {
    await getResourceLimit(resource);

    setLoading(false);
  };

  useEffect(() => {
    if (resource && config?.enable) {
      initResourceLimit();
    }

    return () => {
      setBannerDetails(null);
    };
  }, [resource, config?.enable]);
  const currentLimits = resourceLimit[resource];

  const limitReached = currentLimits?.limitReached;

  // If limit configuration is disabled or current count is -1, then return the children
  if (!config?.enable || currentLimits?.currentCount === -1) {
    return children;
  }

  if (loading) {
    return <Skeleton active />;
  }

  return limitReached ? (
    <Tooltip
      title={`You have used ${currentLimits?.currentCount} out of ${currentLimits?.configuredLimit.limits.hardLimit} limit`}>
      <span>
        {cloneElement(children, {
          disabled: true,
          onClick: noop,
          classNames: classNames(children.props.className, 'disabled'),
        })}
      </span>
    </Tooltip>
  ) : (
    children
  );
};

export default LimitWrapper;
