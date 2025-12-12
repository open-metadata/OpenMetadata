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
import { APICollection } from '../../generated/entity/data/apiCollection';
import { Container } from '../../generated/entity/data/container';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Database } from '../../generated/entity/data/database';
import { Directory } from '../../generated/entity/data/directory';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { SearchIndex as SearchIndexEntity } from '../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../generated/entity/data/storedProcedure';
import { Topic } from '../../generated/entity/data/topic';

export type ServicePageData =
  | Database
  | Topic
  | Dashboard
  | Mlmodel
  | Pipeline
  | Container
  | DashboardDataModel
  | SearchIndexEntity
  | StoredProcedure
  | APICollection
  | Directory;
