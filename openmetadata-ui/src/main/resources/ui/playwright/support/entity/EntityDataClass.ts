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
import { DataProduct } from '../domain/DataProduct';
import { Domain } from '../domain/Domain';
import { Glossary } from '../glossary/Glossary';
import { GlossaryTerm } from '../glossary/GlossaryTerm';
import { ClassificationClass } from '../tag/ClassificationClass';
import { TagClass } from '../tag/TagClass';
import { TeamClass } from '../team/TeamClass';
import { UserClass } from '../user/UserClass';
import { ApiCollectionClass } from './ApiCollectionClass';
import { ApiEndpointClass } from './ApiEndpointClass';
import { ContainerClass } from './ContainerClass';
import { DashboardClass } from './DashboardClass';
import { DashboardDataModelClass } from './DashboardDataModelClass';
import { DatabaseClass } from './DatabaseClass';
import { DatabaseSchemaClass } from './DatabaseSchemaClass';
import { EntityDataClassCreationConfig } from './EntityDataClass.interface';
import { MlModelClass } from './MlModelClass';
import { PipelineClass } from './PipelineClass';
import { SearchIndexClass } from './SearchIndexClass';
import { ApiServiceClass } from './service/ApiServiceClass';
import { DashboardServiceClass } from './service/DashboardServiceClass';
import { DatabaseServiceClass } from './service/DatabaseServiceClass';
import { MessagingServiceClass } from './service/MessagingServiceClass';
import { MlmodelServiceClass } from './service/MlmodelServiceClass';
import { PipelineServiceClass } from './service/PipelineServiceClass';
import { SearchIndexServiceClass } from './service/SearchIndexServiceClass';
import { StorageServiceClass } from './service/StorageServiceClass';
import { StoredProcedureClass } from './StoredProcedureClass';
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
  static readonly certificationTag1 = new TagClass({
    classification: 'Certification',
  });
  static readonly certificationTag2 = new TagClass({
    classification: 'Certification',
  });
  static readonly classification1 = new ClassificationClass({
    provider: 'system',
    mutuallyExclusive: true,
  });
  static readonly tag1 = new TagClass({
    classification: this.classification1.data.name,
  });
  static readonly table1 = new TableClass();
  static readonly table2 = new TableClass(undefined, 'MaterializedView');
  static readonly topic1 = new TopicClass();
  static readonly topic2 = new TopicClass();
  static readonly dashboard1 = new DashboardClass();
  static readonly dashboard2 = new DashboardClass(undefined, 'LookMlExplore');
  static readonly mlModel1 = new MlModelClass();
  static readonly mlModel2 = new MlModelClass();
  static readonly pipeline1 = new PipelineClass();
  static readonly pipeline2 = new PipelineClass();
  static readonly dashboardDataModel1 = new DashboardDataModelClass();
  static readonly dashboardDataModel2 = new DashboardDataModelClass();
  static readonly apiCollection1 = new ApiCollectionClass();
  static readonly apiCollection2 = new ApiCollectionClass();
  static readonly apiEndpoint1 = new ApiEndpointClass();
  static readonly apiEndpoint2 = new ApiEndpointClass();
  static readonly storedProcedure1 = new StoredProcedureClass();
  static readonly storedProcedure2 = new StoredProcedureClass();
  static readonly searchIndex1 = new SearchIndexClass();
  static readonly searchIndex2 = new SearchIndexClass();
  static readonly container1 = new ContainerClass();
  static readonly container2 = new ContainerClass();
  static readonly databaseService = new DatabaseServiceClass();
  static readonly database = new DatabaseClass();
  static readonly databaseSchema = new DatabaseSchemaClass();
  static readonly apiService = new ApiServiceClass();
  static readonly dashboardService = new DashboardServiceClass();
  static readonly messagingService = new MessagingServiceClass();
  static readonly mlmodelService = new MlmodelServiceClass();
  static readonly pipelineService = new PipelineServiceClass();
  static readonly searchIndexService = new SearchIndexServiceClass();
  static readonly storageService = new StorageServiceClass();
  static readonly dataProduct1 = new DataProduct([this.domain1]);
  static readonly dataProduct2 = new DataProduct([this.domain1]);
  static readonly dataProduct3 = new DataProduct([this.domain2]);

  static async preRequisitesForTests(
    apiContext: APIRequestContext,
    creationConfig: EntityDataClassCreationConfig = {
      entityDetails: true,
    }
  ) {
    // Add pre-requisites for tests
    const promises =
      creationConfig.entityDetails || creationConfig.all
        ? [
            this.domain1.create(apiContext),
            this.domain2.create(apiContext),
            this.glossary1.create(apiContext),
            this.glossary2.create(apiContext),
            this.user1.create(apiContext),
            this.user2.create(apiContext),
            this.user3.create(apiContext),
            this.team1.create(apiContext),
            this.team2.create(apiContext),
            this.tierTag1.create(apiContext),
            this.tierTag2.create(apiContext),
            this.certificationTag1.create(apiContext),
            this.certificationTag2.create(apiContext),
            this.classification1.create(apiContext),
          ]
        : [];

    if (creationConfig?.all || creationConfig?.table) {
      promises.push(this.table1.create(apiContext));
      promises.push(this.table2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.topic) {
      promises.push(this.topic1.create(apiContext));
      promises.push(this.topic2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.dashboard) {
      promises.push(this.dashboard1.create(apiContext));
      promises.push(this.dashboard2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.mlModel) {
      promises.push(this.mlModel1.create(apiContext));
      promises.push(this.mlModel2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.pipeline) {
      promises.push(this.pipeline1.create(apiContext));
      promises.push(this.pipeline2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.dashboardDataModel) {
      promises.push(this.dashboardDataModel1.create(apiContext));
      promises.push(this.dashboardDataModel2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.apiCollection) {
      promises.push(this.apiCollection1.create(apiContext));
      promises.push(this.apiCollection2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.apiEndpoint) {
      promises.push(this.apiEndpoint1.create(apiContext));
      promises.push(this.apiEndpoint2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.storedProcedure) {
      promises.push(this.storedProcedure1.create(apiContext));
      promises.push(this.storedProcedure2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.searchIndex) {
      promises.push(this.searchIndex1.create(apiContext));
      promises.push(this.searchIndex2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.container) {
      promises.push(this.container1.create(apiContext));
      promises.push(this.container2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.databaseService) {
      promises.push(this.databaseService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.database) {
      promises.push(this.database.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.databaseSchema) {
      promises.push(this.databaseSchema.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.apiService) {
      promises.push(this.apiService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.dashboardService) {
      promises.push(this.dashboardService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.messagingService) {
      promises.push(this.messagingService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.mlmodelService) {
      promises.push(this.mlmodelService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.pipelineService) {
      promises.push(this.pipelineService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.searchIndexService) {
      promises.push(this.searchIndexService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.storageService) {
      promises.push(this.storageService.create(apiContext));
    }

    await Promise.allSettled(promises);

    if (creationConfig?.all || creationConfig?.entityDetails) {
      await Promise.allSettled([
        this.glossaryTerm1.create(apiContext),
        this.glossaryTerm2.create(apiContext),
        this.dataProduct1.create(apiContext),
        this.dataProduct2.create(apiContext),
        this.dataProduct3.create(apiContext),
        this.tag1.create(apiContext),
      ]);
    }
  }

  static async postRequisitesForTests(
    apiContext: APIRequestContext,
    creationConfig: EntityDataClassCreationConfig = {
      entityDetails: true,
    }
  ) {
    const promises =
      creationConfig?.entityDetails || creationConfig?.all
        ? [
            this.domain1.delete(apiContext),
            this.domain2.delete(apiContext),
            // deleting glossary will also delete the glossary terms
            this.glossary1.delete(apiContext),
            this.glossary2.delete(apiContext),
            this.user1.delete(apiContext),
            this.user2.delete(apiContext),
            this.user3.delete(apiContext),
            this.team1.delete(apiContext),
            this.team2.delete(apiContext),
            this.tierTag1.delete(apiContext),
            this.tierTag2.delete(apiContext),
            this.certificationTag1.delete(apiContext),
            this.certificationTag2.delete(apiContext),
            this.classification1.delete(apiContext),
            this.tag1.delete(apiContext),
            this.dataProduct1.delete(apiContext),
            this.dataProduct2.delete(apiContext),
            this.dataProduct3.delete(apiContext),
          ]
        : [];

    if (creationConfig?.all || creationConfig?.table) {
      promises.push(this.table1.delete(apiContext));
      promises.push(this.table2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.topic) {
      promises.push(this.topic1.delete(apiContext));
      promises.push(this.topic2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.dashboard) {
      promises.push(this.dashboard1.delete(apiContext));
      promises.push(this.dashboard2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.mlModel) {
      promises.push(this.mlModel1.delete(apiContext));
      promises.push(this.mlModel2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.pipeline) {
      promises.push(this.pipeline1.delete(apiContext));
      promises.push(this.pipeline2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.dashboardDataModel) {
      promises.push(this.dashboardDataModel1.delete(apiContext));
      promises.push(this.dashboardDataModel2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.apiCollection) {
      promises.push(this.apiCollection1.delete(apiContext));
      promises.push(this.apiCollection2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.apiEndpoint) {
      promises.push(this.apiEndpoint1.delete(apiContext));
      promises.push(this.apiEndpoint2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.storedProcedure) {
      promises.push(this.storedProcedure1.delete(apiContext));
      promises.push(this.storedProcedure2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.searchIndex) {
      promises.push(this.searchIndex1.delete(apiContext));
      promises.push(this.searchIndex2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.container) {
      promises.push(this.container1.delete(apiContext));
      promises.push(this.container2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.databaseService) {
      promises.push(this.databaseService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.database) {
      promises.push(this.database.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.databaseSchema) {
      promises.push(this.databaseSchema.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.apiService) {
      promises.push(this.apiService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.dashboardService) {
      promises.push(this.dashboardService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.messagingService) {
      promises.push(this.messagingService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.mlmodelService) {
      promises.push(this.mlmodelService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.pipelineService) {
      promises.push(this.pipelineService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.searchIndexService) {
      promises.push(this.searchIndexService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.storageService) {
      promises.push(this.storageService.delete(apiContext));
    }

    return await Promise.allSettled(promises);
  }
}
