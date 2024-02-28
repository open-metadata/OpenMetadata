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

import { ThreadType } from '../../../generated/api/feed/createThread';
import {
  ColumnJoins,
  Table,
  TableData,
} from '../../../generated/entity/data/table';

export type Props = {
  columns: Table['columns'];
  joins: Array<ColumnJoins>;
  columnName: string;
  tableConstraints: Table['tableConstraints'];
  sampleData?: TableData;
  hasDescriptionEditAccess: boolean;
  hasTagEditAccess: boolean;
  isReadOnly?: boolean;
  entityFqn: string;
  onThreadLinkSelect: (value: string, threadType?: ThreadType) => void;
  onUpdate: (columns: Table['columns']) => Promise<void>;
};
