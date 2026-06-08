/*
 *  Copyright 2026 Collate.
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
  BreadcrumbItemType,
  Breadcrumbs,
  BreadcrumbsDivider,
  BreadcrumbsSize,
  BreadcrumbsType,
} from '@openmetadata/ui-core-components';
import { HomeLine } from '@untitledui/icons';
import { FC, Key, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';

export interface BreadcrumbProps {
  /**
   * Ordered list of crumb items. Each item needs `label` and optionally `href`
   * and `icon`. The `id` is assigned automatically based on index.
   * The last item is treated as the current page (no href needed).
   */
  items: Omit<BreadcrumbItemType, 'id'>[];
  /**
   * When true, prepends a home crumb that navigates to ROUTES.HOME.
   * Defaults to false.
   */
  showHome?: boolean;
  /** Visual style of the crumbs. Defaults to 'text'. */
  type?: BreadcrumbsType;
  /** Separator between crumbs. Defaults to 'chevron'. */
  divider?: BreadcrumbsDivider;
  /** Size of the crumbs. Defaults to 'sm'. */
  size?: BreadcrumbsSize;
  /** Optional class name applied to the root nav element. */
  className?: string;
}

const HOME_CRUMB_ID = '__breadcrumb_home__';

const Breadcrumb: FC<BreadcrumbProps> = ({
  items,
  showHome = false,
  type,
  divider,
  size,
  className,
}) => {
  const navigate = useNavigate();

  const allItems: BreadcrumbItemType[] = useMemo(() => {
    const numbered = items.map((item, index) => ({
      ...item,
      id: String(index),
    }));

    if (!showHome) {
      return numbered;
    }

    return [
      {
        id: HOME_CRUMB_ID,
        label: '',
        icon: HomeLine,
        href: ROUTES.HOME,
      },
      ...numbered,
    ];
  }, [items, showHome]);

  const handleAction = useCallback(
    (id: Key) => {
      const item = allItems.find((b) => b.id === id);
      if (item?.href) {
        navigate(item.href);
      }
    },
    [allItems, navigate]
  );

  return (
    <Breadcrumbs
      className={className}
      divider={divider}
      items={allItems}
      size={size}
      type={type}
      onAction={handleAction}
    />
  );
};

export default Breadcrumb;
