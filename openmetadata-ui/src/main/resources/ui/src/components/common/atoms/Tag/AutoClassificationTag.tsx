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

import { Badge } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as AutomatedTag } from '../../../../assets/svg/automated-tag.svg';

interface AutoClassificationTagProps {
  label: string;
  href: string;
  'data-testid'?: string;
}

/**
 * Brand-colored chip for auto-classified (LabelType.Generated) tags.
 * Visually distinct from manually applied classification tags — uses
 * the utility-brand palette with an AutomatedTag icon.
 */
const AutoClassificationTag: FC<AutoClassificationTagProps> = ({
  label,
  href,
  ...otherProps
}) => (
  <Link className="no-underline" data-testid="tag-redirect-link" to={href}>
    <Badge
      className="tw:cursor-pointer tw:text-utility-brand-700 tw:outline-utility-brand-100 tw:bg-utility-brand-50 hover:tw:bg-utility-brand-50"
      color="brand"
      size="sm"
      type="color">
      <span className="tw:flex tw:items-center tw:gap-1">
        <AutomatedTag
          className="tw:text-utility-brand-900 tw:shrink-0"
          width={16}
        />
        <span
          className="tw:text-utility-brand-900"
          data-testid={otherProps['data-testid']}>
          {label}
        </span>
      </span>
    </Badge>
  </Link>
);

export default AutoClassificationTag;
