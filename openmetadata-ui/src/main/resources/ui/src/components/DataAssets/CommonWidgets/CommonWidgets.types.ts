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
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import {
  ChangeDescription,
  EntityReference,
} from '../../../generated/entity/type';
import type { WidgetConfig } from '../../../interface/customization.interface';

export interface GenericEntity
  extends Exclude<EntityReference, 'type'>,
    Pick<
      Table,
      | 'deleted'
      | 'description'
      | 'owners'
      | 'domains'
      | 'dataProducts'
      | 'extension'
      | 'tags'
    > {
  changeDescription: ChangeDescription;
}

export interface CommonWidgetProps {
  widgetConfig: WidgetConfig;
  entityType: EntityType;
  showTaskHandler: boolean;
}

export type CommonWidgetComponent = (
  props: CommonWidgetProps
) => JSX.Element | null;
