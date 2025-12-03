/*
 *  Copyright 2024 Collate.
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
import { MlFeature } from '../../../../generated/entity/data/mlmodel';
import { SearchIndexField } from '../../../../generated/entity/data/searchIndex';
import { Column } from '../../../../generated/entity/data/table';
import { Field } from '../../../../generated/entity/data/topic';
import { EntityReference } from '../../../../generated/entity/type';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';

export interface NodeChildrenProps {
  node: SearchedDataProps['data'][number]['_source'];
  isConnectable: boolean;
  isChildrenListExpanded: boolean;
}

export type EntityChildren =
  | Column[]
  | EntityReference[]
  | MlFeature[]
  | Field[]
  | SearchIndexField[];
