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

import { CreateThread } from '../../generated/api/feed/createThread';
import { Table } from '../../generated/entity/data/table';
import { EntityFieldThreadCount } from '../../interface/feed.interface';

export interface DatasetDetailsProps {
  entityId?: string;
  tableDetails: Table;
  dataModel?: Table['dataModel'];
  tableProfile: Table['profile'];
  isTableProfileLoading?: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  createThread: (data: CreateThread) => void;
  followTableHandler: () => void;
  unFollowTableHandler: () => void;
  versionHandler: () => void;
  onTableUpdate: (updatedTable: Table, key: keyof Table) => Promise<void>;
}
