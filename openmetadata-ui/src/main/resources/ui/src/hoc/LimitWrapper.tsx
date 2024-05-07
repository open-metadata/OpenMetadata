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

import { Skeleton, Tooltip } from 'antd';
import classNames from 'classnames';
import { noop } from 'lodash';
import React, { ReactElement, useEffect, useState } from 'react';
import { useLimitStore } from '../context/LimitsProvider/useLimitsStore';
import { getLimitByResource } from '../rest/limitsAPI';

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
export const LimitWrapper = ({ resource, children }: LimitWrapperProps) => {
  const { resourceLimit, setResourceLimit, config } = useLimitStore();
  const [loading, setLoading] = useState(false);

  const fetchResourceLimit = async () => {
    setLoading(true);
    const response = await getLimitByResource(resource);

    setResourceLimit(resource, response);
    setLoading(false);
  };

  useEffect(() => {
    if (resource) {
      fetchResourceLimit();
    }
  }, [resource]);
  const currentLimits = resourceLimit[resource];

  const limitReached =
    currentLimits?.used >= currentLimits?.assetLimits.hardLimit;

  if (!config?.enable) {
    return children;
  }

  if (loading) {
    return <Skeleton active />;
  }

  return limitReached ? (
    <Tooltip
      title={`You have used ${currentLimits?.used} out of ${currentLimits?.assetLimits.hardLimit} limit`}>
      {React.cloneElement(children, {
        disabled: true,
        onClick: noop,
        classNames: classNames(children.props.className, 'disabled'),
      })}
    </Tooltip>
  ) : (
    children
  );
};
