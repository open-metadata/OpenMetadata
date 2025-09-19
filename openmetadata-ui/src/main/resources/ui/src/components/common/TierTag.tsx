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
import classNames from 'classnames';
import React from 'react';
import { TagLabel } from '../../generated/type/tagLabel';
import { getEntityName } from '../../utils/EntityUtils';

interface TierTagProps {
  tier: TagLabel;
  className?: string;
  size?: 'small' | 'default' | 'large';
}

const TierTag: React.FC<TierTagProps> = ({ tier, className = '' }) => {
  return (
    <span
      className={classNames(
        'tier-tag inline-block font-medium p-x-xs p-y-xss text-xs',
        className
      )}
      data-testid="tier-tag"
      title={tier.tagFQN}>
      {getEntityName(tier)}
    </span>
  );
};

export default TierTag;
