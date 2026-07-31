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
import type { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import type React from 'react';
import type { EntityReference } from '../generated/entity/type';
import type { Option } from '../pages/TasksPage/TasksPage.interface';
import { getUserAndTeamSearch } from '../rest/miscAPI';
import { getEntityName } from './EntityNameUtils';
import { showErrorToast } from './ToastUtils';

export const fetchOptions = ({
  query,
  setOptions,
  onlyUsers,
  currentUserId,
  initialOptions,
}: {
  query: string;
  setOptions: (value: React.SetStateAction<Option[]>) => void;
  onlyUsers?: boolean;
  currentUserId?: string;
  initialOptions?: Option[];
}) => {
  if (isEmpty(query) && initialOptions) {
    setOptions(initialOptions);

    return;
  }
  getUserAndTeamSearch(query, onlyUsers)
    .then((res) => {
      const hits = res.data.hits.hits;
      const suggestOptions = hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._id ?? '',
        type: hit._source.entityType,
        name: hit._source.name,
        displayName: hit._source.displayName,
      }));

      setOptions(suggestOptions.filter((item) => item.value !== currentUserId));
    })
    .catch((err: AxiosError) => showErrorToast(err));
};

export const generateOptions = (assignees: EntityReference[]) => {
  return assignees.map((assignee) => ({
    label: getEntityName(assignee),
    value: assignee.id || '',
    type: assignee.type,
    name: assignee.name,
    displayName: assignee.displayName,
  }));
};
