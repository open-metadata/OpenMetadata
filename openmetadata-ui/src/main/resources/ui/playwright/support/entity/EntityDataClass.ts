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
import { APIRequestContext } from '@playwright/test';
import { Domain } from '../domain/Domain';
import { Glossary } from '../glossary/Glossary';
import { GlossaryTerm } from '../glossary/GlossaryTerm';
import { TagClass } from '../tag/TagClass';
import { TeamClass } from '../team/TeamClass';
import { UserClass } from '../user/UserClass';
import { ApiCollectionClass } from './ApiCollectionClass';
import { DashboardClass } from './DashboardClass';
import { DashboardDataModelClass } from './DashboardDataModelClass';
import { MlModelClass } from './MlModelClass';
import { PipelineClass } from './PipelineClass';
import { SearchIndexClass } from './SearchIndexClass';
import { TableClass } from './TableClass';
import { TopicClass } from './TopicClass';

export class EntityDataClass {
  static readonly domain1 = new Domain();
  static readonly domain2 = new Domain();
  static readonly glossary1 = new Glossary();
  static readonly glossary2 = new Glossary();
  static readonly glossaryTerm1 = new GlossaryTerm(this.glossary1);
  static readonly glossaryTerm2 = new GlossaryTerm(this.glossary2);
  static readonly user1 = new UserClass();
  static readonly user2 = new UserClass();
  static readonly user3 = new UserClass();
  static readonly team1 = new TeamClass();
  static readonly team2 = new TeamClass();
  static readonly tierTag1 = new TagClass({ classification: 'Tier' });
  static readonly tierTag2 = new TagClass({ classification: 'Tier' });
  static readonly table1 = new TableClass();
  static readonly table2 = new TableClass();
  static readonly topic1 = new TopicClass();
  static readonly topic2 = new TopicClass();
  static readonly dashboard1 = new DashboardClass();
  static readonly dashboard2 = new DashboardClass(undefined, 'LookMlExplore');
  static readonly mlModel1 = new MlModelClass();
  static readonly pipeline1 = new PipelineClass();
  static readonly dashboardDataModel1 = new DashboardDataModelClass();
  static readonly dashboardDataModel2 = new DashboardDataModelClass();
  static readonly apiCollection1 = new ApiCollectionClass();
  static readonly apiCollection2 = new ApiCollectionClass();
  static readonly searchIndex1 = new SearchIndexClass();
  static readonly searchIndex2 = new SearchIndexClass();

  static async preRequisitesForTests(apiContext: APIRequestContext) {
    // Add pre-requisites for tests
    await this.domain1.create(apiContext);
    await this.domain2.create(apiContext);
    await this.glossary1.create(apiContext);
    await this.glossary2.create(apiContext);
    await this.glossaryTerm1.create(apiContext);
    await this.glossaryTerm2.create(apiContext);
    await this.user1.create(apiContext);
    await this.user2.create(apiContext);
    await this.user3.create(apiContext);
    await this.team1.create(apiContext);
    await this.team2.create(apiContext);
    await this.tierTag1.create(apiContext);
    await this.tierTag2.create(apiContext);
    await this.table1.create(apiContext);
    await this.table2.create(apiContext);
    await this.topic1.create(apiContext);
    await this.topic2.create(apiContext);
    await this.dashboard1.create(apiContext);
    await this.dashboard2.create(apiContext);
    await this.mlModel1.create(apiContext);
    await this.pipeline1.create(apiContext);
    await this.dashboardDataModel1.create(apiContext);
    await this.dashboardDataModel2.create(apiContext);
    await this.apiCollection1.create(apiContext);
    await this.apiCollection2.create(apiContext);
    await this.searchIndex1.create(apiContext);
    await this.searchIndex2.create(apiContext);
  }

  static async postRequisitesForTests(apiContext: APIRequestContext) {
    // Add post-requisites for tests
    await this.domain1.delete(apiContext);
    await this.domain2.delete(apiContext);
    // deleting glossary will also delete the glossary terms
    await this.glossary1.delete(apiContext);
    await this.glossary2.delete(apiContext);
    await this.user1.delete(apiContext);
    await this.user2.delete(apiContext);
    await this.user3.delete(apiContext);
    await this.team1.delete(apiContext);
    await this.team2.delete(apiContext);
    await this.tierTag1.delete(apiContext);
    await this.tierTag2.delete(apiContext);
    await this.table1.delete(apiContext);
    await this.table2.delete(apiContext);
    await this.topic1.delete(apiContext);
    await this.topic2.delete(apiContext);
    await this.dashboard1.delete(apiContext);
    await this.dashboard2.delete(apiContext);
    await this.mlModel1.delete(apiContext);
    await this.pipeline1.delete(apiContext);
    await this.dashboardDataModel1.delete(apiContext);
    await this.dashboardDataModel2.delete(apiContext);
    await this.apiCollection1.delete(apiContext);
    await this.apiCollection2.delete(apiContext);
    await this.searchIndex1.delete(apiContext);
    await this.searchIndex2.delete(apiContext);
  }
}
