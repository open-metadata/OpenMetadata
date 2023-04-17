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

import { TableProps } from 'antd';
import { HTMLAttributes, ReactNode } from 'react';
import { Field, Topic } from '../../../generated/entity/data/topic';

export type CellRendered<T, K extends keyof T> = (
  value: T[K],
  record: T,
  index: number
) => ReactNode;

export interface TopicSchemaFieldsProps
  extends HTMLAttributes<TableProps<Field>> {
  messageSchema: Topic['messageSchema'];
  hasDescriptionEditAccess: boolean;
  hasTagEditAccess: boolean;
  isReadOnly: boolean;
  onUpdate: (updatedMessageSchema: Topic['messageSchema']) => Promise<void>;
}

export enum SchemaViewType {
  FIELDS = 'fields',
  TEXT = 'text',
}
