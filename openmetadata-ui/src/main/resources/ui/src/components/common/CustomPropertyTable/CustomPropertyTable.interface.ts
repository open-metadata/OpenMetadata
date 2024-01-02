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

import { EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';

export type ExtentionEntities = {
  [EntityType.TABLE]: Table;
  [EntityType.TOPIC]: Topic;
  [EntityType.DASHBOARD]: Dashboard;
  [EntityType.PIPELINE]: Pipeline;
  [EntityType.MLMODEL]: Mlmodel;
  [EntityType.CONTAINER]: Container;
  [EntityType.SEARCH_INDEX]: SearchIndex;
  [EntityType.STORED_PROCEDURE]: StoredProcedure;
  [EntityType.GLOSSARY_TERM]: GlossaryTerm;
  [EntityType.DATABASE]: Database;
  [EntityType.DATABASE_SCHEMA]: DatabaseSchema;
};

export type ExtentionEntitiesKeys = keyof ExtentionEntities;

export interface CustomPropertyProps<T extends ExtentionEntitiesKeys> {
  isVersionView?: boolean;
  entityType: T;
  entityDetails?: ExtentionEntities[T];
  handleExtensionUpdate?: (updatedTable: ExtentionEntities[T]) => Promise<void>;
  hasEditAccess: boolean;
  className?: string;
  hasPermission: boolean;
}
