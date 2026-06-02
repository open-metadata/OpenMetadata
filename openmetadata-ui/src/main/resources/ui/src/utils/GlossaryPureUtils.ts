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

import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import Fqn from './Fqn';
import { getGlossaryPath } from './RouterUtils';

export const StatusClass = {
  [EntityStatus.Approved]: StatusType.Success,
  [EntityStatus.Draft]: StatusType.Pending,
  [EntityStatus.Rejected]: StatusType.Failure,
  [EntityStatus.Deprecated]: StatusType.Deprecated,
  [EntityStatus.InReview]: StatusType.InReview,
  [EntityStatus.Unprocessed]: StatusType.Unprocessed,
};

export const StatusFilters = Object.values(EntityStatus)
  .filter((status) => status !== EntityStatus.Deprecated) // Deprecated not in use for this release
  .map((status) => ({
    text: status,
    value: status,
  }));

export const getGlossaryBreadcrumbs = (fqn: string) => {
  const arr = Fqn.split(fqn);
  const dataFQN: Array<string> = [];
  const breadcrumbList = [
    {
      name: 'Glossaries',
      url: getGlossaryPath(''),
      activeTitle: false,
    },
    ...arr.map((d) => {
      dataFQN.push(d);

      return {
        name: d,
        url: getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
        activeTitle: false,
      };
    }),
  ];

  return breadcrumbList;
};
