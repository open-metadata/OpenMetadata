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
import i18next from 'i18next';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import entityUtilClassBase from '../EntityUtilClassBase';
import Fqn from '../Fqn';

export const isBulkEditRoute = (pathname: string) => {
  return pathname.includes(ROUTES.BULK_EDIT_ENTITY);
};

export const getBulkEntityEditBreadcrumbList = (
  entityType: EntityType,
  fqn: string
): TitleBreadcrumbProps['titleLinks'] => [
  {
    name: Fqn.split(fqn).pop(),
    url: entityUtilClassBase.getEntityLink(entityType, fqn),
  },
  {
    name: i18next.t('label.bulk-edit'),
    url: '',
    activeTitle: true,
  },
];
