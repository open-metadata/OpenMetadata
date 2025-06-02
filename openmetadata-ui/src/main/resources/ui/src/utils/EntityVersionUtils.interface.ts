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

import { APICollection } from '../generated/entity/data/apiCollection';
import { Column as ContainerColumn } from '../generated/entity/data/container';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { Column as TableColumn } from '../generated/entity/data/table';
import { Field } from '../generated/entity/data/topic';
import { TestCase } from '../generated/tests/testCase';
import { TagLabel } from '../generated/type/tagLabel';
import { ServicesType } from '../interface/service.interface';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';

export interface TagLabelWithStatus extends TagLabel {
  added: boolean | undefined;
  removed: boolean | undefined;
}

export interface VersionStatus {
  added?: boolean;
  removed?: boolean;
}

export type VersionEntityTypes =
  | VersionData
  | Glossary
  | GlossaryTerm
  | ServicesType
  | Database
  | DatabaseSchema
  | APICollection
  | TestCase;

export type AssetsChildForVersionPages = TableColumn | ContainerColumn | Field;
