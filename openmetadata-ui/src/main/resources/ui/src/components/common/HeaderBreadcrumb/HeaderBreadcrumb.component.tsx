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
} from '@openmetadata/ui-core-components';
import { HomeLine } from '@untitledui/icons';
import { FC, Key, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { HeaderBreadcrumbProps } from './HeaderBreadcrumb.interface';

const HOME_CRUMB_ID = '__breadcrumb_home__';

const HeaderBreadcrumb: FC<HeaderBreadcrumbProps> = ({
  items,
  showHome = false,
  type,
  divider,
  size,
  className,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        label: null,
        ariaLabel: t('label.home'),
        icon: HomeLine,
        href: ROUTES.HOME,
      },
      ...numbered,
    ];
  }, [items, showHome, t]);

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

export default HeaderBreadcrumb;
