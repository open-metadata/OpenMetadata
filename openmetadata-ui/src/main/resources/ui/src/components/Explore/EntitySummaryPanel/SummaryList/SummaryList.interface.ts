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

import { ReactNode } from 'react';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ChartType } from '../../../../generated/entity/data/chart';
import { FeatureType } from '../../../../generated/entity/data/mlmodel';
import {
  Constraint,
  DataType,
  TableConstraint,
} from '../../../../generated/entity/data/table';
import { TagLabel } from '../../../../generated/type/tagLabel';

export interface HighlightedTagLabel extends TagLabel {
  isHighlighted: boolean;
}

export interface BasicEntityInfo {
  algorithm?: string;
  name: string;
  title: ReactNode;
  type?: DataType | ChartType | FeatureType | string;
  tags?: Array<TagLabel | HighlightedTagLabel>;
  description?: string;
  columnConstraint?: Constraint;
  tableConstraints?: TableConstraint[];
  children?: BasicEntityInfo[];
}

export interface SummaryListProps {
  formattedEntityData: BasicEntityInfo[];
  entityType?: SummaryEntityType;
  emptyPlaceholderText?: string;
  loading?: boolean;
}
