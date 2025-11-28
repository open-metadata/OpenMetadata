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
import * as fs from 'fs';
import * as path from 'path';
import { uuid } from '../../utils/common';
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
import { ChartClass } from './ChartClass';
import { ContainerClass } from './ContainerClass';
import { DashboardClass } from './DashboardClass';
import { DashboardDataModelClass } from './DashboardDataModelClass';
import { DatabaseClass } from './DatabaseClass';
import { DatabaseSchemaClass } from './DatabaseSchemaClass';
import { DirectoryClass } from './DirectoryClass';
import { FileClass } from './FileClass';
import { MetricClass } from './MetricClass';
import { MlModelClass } from './MlModelClass';
import { PipelineClass } from './PipelineClass';
import { SearchIndexClass } from './SearchIndexClass';
import { ApiServiceClass } from './service/ApiServiceClass';
import { DashboardServiceClass } from './service/DashboardServiceClass';
import { DatabaseServiceClass } from './service/DatabaseServiceClass';
import { DriveServiceClass } from './service/DriveServiceClass';
import { MessagingServiceClass } from './service/MessagingServiceClass';
import { MlmodelServiceClass } from './service/MlmodelServiceClass';
import { PipelineServiceClass } from './service/PipelineServiceClass';
import { SearchIndexServiceClass } from './service/SearchIndexServiceClass';
import { StorageServiceClass } from './service/StorageServiceClass';
import { SpreadsheetClass } from './SpreadsheetClass';
import { StoredProcedureClass } from './StoredProcedureClass';
import { TableClass } from './TableClass';
import { TopicClass } from './TopicClass';
import { WorksheetClass } from './WorksheetClass';

const randomUUID = uuid();

export class EntityDataClass {
  static readonly domain1 = new Domain();
  static readonly domain2 = new Domain();
  static readonly glossary1 = new Glossary();
  static readonly glossary2 = new Glossary();
  static readonly glossaryTerm1 = new GlossaryTerm(this.glossary1);
  static readonly glossaryTerm2 = new GlossaryTerm(this.glossary2);
  static readonly user1 = new UserClass({
    email: `pw.user.one-${randomUUID}@example.com`,
    firstName: 'PW.User.',
    lastName: `One-${randomUUID}`,
    password: 'User@OMD123',
  });
  static readonly user2 = new UserClass({
    email: `pw.user.two-${randomUUID}@example.com`,
    firstName: 'PW.User.',
    lastName: `Two-${randomUUID}`,
    password: 'User@OMD123',
  });
  static readonly user3 = new UserClass({
    email: `pw.user.three-${randomUUID}@example.com`,
    firstName: 'PW.User.',
    lastName: `Three-${randomUUID}`,
    password: 'User@OMD123',
  });
  static readonly team1 = new TeamClass({
    name: `PW%team-1${randomUUID}`,
    displayName: `PW Team 1 ${randomUUID}`,
    description: 'playwright team 1 description',
    teamType: 'Group',
    users: [],
    policies: [],
  });
  static readonly team2 = new TeamClass({
    name: `PW%team-2${randomUUID}`,
    displayName: `PW Team 2 ${randomUUID}`,
    description: 'playwright team 2 description',
    teamType: 'Group',
    users: [],
    policies: [],
  });
  static readonly certificationTag1 = new TagClass({
    classification: 'Certification',
  });
  static readonly certificationTag2 = new TagClass({
    classification: 'Certification',
  });
  static readonly tierTag1 = new TagClass({
    classification: 'Tier',
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
  static readonly driveService = new DriveServiceClass();
  static readonly dataProduct1 = new DataProduct([this.domain1]);
  static readonly dataProduct2 = new DataProduct([this.domain1]);
  static readonly dataProduct3 = new DataProduct([this.domain2]);
  static readonly metric1 = new MetricClass();
  static readonly chart1 = new ChartClass();
  static readonly directory1 = new DirectoryClass();
  static readonly directory2 = new DirectoryClass();
  static readonly file1 = new FileClass();
  static readonly file2 = new FileClass();
  static readonly spreadsheet1 = new SpreadsheetClass();
  static readonly spreadsheet2 = new SpreadsheetClass();
  static readonly worksheet1 = new WorksheetClass();
  static readonly worksheet2 = new WorksheetClass();

  static async preRequisitesForTests(apiContext: APIRequestContext) {
    // Add pre-requisites for tests
    const promises = [
      this.domain1.create(apiContext),
      this.domain2.create(apiContext),
      this.glossary1.create(apiContext),
      this.glossary2.create(apiContext),
      this.user1.create(apiContext),
      this.user2.create(apiContext),
      this.user3.create(apiContext),
      this.team1.create(apiContext),
      this.team2.create(apiContext),
      this.certificationTag1.create(apiContext),
      this.certificationTag2.create(apiContext),
      this.tierTag1.create(apiContext),
      this.classification1.create(apiContext),
      this.table1.create(apiContext),
      this.table2.create(apiContext),
      this.topic1.create(apiContext),
      this.topic2.create(apiContext),
      this.dashboard1.create(apiContext),
      this.dashboard2.create(apiContext),
      this.mlModel1.create(apiContext),
      this.mlModel2.create(apiContext),
      this.pipeline1.create(apiContext),
      this.pipeline2.create(apiContext),
      this.dashboardDataModel1.create(apiContext),
      this.dashboardDataModel2.create(apiContext),
      this.apiCollection1.create(apiContext),
      this.apiCollection2.create(apiContext),
      this.apiEndpoint1.create(apiContext),
      this.apiEndpoint2.create(apiContext),
      this.storedProcedure1.create(apiContext),
      this.storedProcedure2.create(apiContext),
      this.searchIndex1.create(apiContext),
      this.searchIndex2.create(apiContext),
      this.container1.create(apiContext),
      this.container2.create(apiContext),
      this.databaseService.create(apiContext),
      this.database.create(apiContext),
      this.databaseSchema.create(apiContext),
      this.apiService.create(apiContext),
      this.dashboardService.create(apiContext),
      this.messagingService.create(apiContext),
      this.mlmodelService.create(apiContext),
      this.pipelineService.create(apiContext),
      this.searchIndexService.create(apiContext),
      this.storageService.create(apiContext),
      this.metric1.create(apiContext),
      this.chart1.create(apiContext),
      this.driveService.create(apiContext),
      this.directory1.create(apiContext),
      this.directory2.create(apiContext),
      this.file1.create(apiContext),
      this.file2.create(apiContext),
      this.spreadsheet1.create(apiContext),
      this.spreadsheet2.create(apiContext),
      this.worksheet1.create(apiContext),
      this.worksheet2.create(apiContext),
    ];

    await Promise.allSettled(promises);

    // Keeping these creations separate as they depend on
    // Entity creation above
    const dependentEntityCreationPromises = [
      this.glossaryTerm1.create(apiContext),
      this.glossaryTerm2.create(apiContext),
      this.dataProduct1.create(apiContext),
      this.dataProduct2.create(apiContext),
      this.dataProduct3.create(apiContext),
      this.tag1.create(apiContext),
    ];

    await Promise.allSettled(dependentEntityCreationPromises);
  }

  static async postRequisitesForTests(apiContext: APIRequestContext) {
    const promises = [
      this.domain1.delete(apiContext),
      this.domain2.delete(apiContext),
      this.glossary1.delete(apiContext),
      this.glossary2.delete(apiContext),
      this.user1.delete(apiContext),
      this.user2.delete(apiContext),
      this.user3.delete(apiContext),
      this.team1.delete(apiContext),
      this.team2.delete(apiContext),
      this.certificationTag1.delete(apiContext),
      this.certificationTag2.delete(apiContext),
      this.tierTag1.delete(apiContext),
      this.classification1.delete(apiContext),
      this.glossaryTerm1.delete(apiContext),
      this.glossaryTerm2.delete(apiContext),
      this.dataProduct1.delete(apiContext),
      this.dataProduct2.delete(apiContext),
      this.dataProduct3.delete(apiContext),
      this.tag1.delete(apiContext),
      this.table1.delete(apiContext),
      this.table2.delete(apiContext),
      this.topic1.delete(apiContext),
      this.topic2.delete(apiContext),
      this.dashboard1.delete(apiContext),
      this.dashboard2.delete(apiContext),
      this.mlModel1.delete(apiContext),
      this.mlModel2.delete(apiContext),
      this.pipeline1.delete(apiContext),
      this.pipeline2.delete(apiContext),
      this.dashboardDataModel1.delete(apiContext),
      this.dashboardDataModel2.delete(apiContext),
      this.apiCollection1.delete(apiContext),
      this.apiCollection2.delete(apiContext),
      this.apiEndpoint1.delete(apiContext),
      this.apiEndpoint2.delete(apiContext),
      this.storedProcedure1.delete(apiContext),
      this.storedProcedure2.delete(apiContext),
      this.searchIndex1.delete(apiContext),
      this.searchIndex2.delete(apiContext),
      this.container1.delete(apiContext),
      this.container2.delete(apiContext),
      this.databaseService.delete(apiContext),
      this.database.delete(apiContext),
      this.databaseSchema.delete(apiContext),
      this.apiService.delete(apiContext),
      this.dashboardService.delete(apiContext),
      this.messagingService.delete(apiContext),
      this.mlmodelService.delete(apiContext),
      this.pipelineService.delete(apiContext),
      this.searchIndexService.delete(apiContext),
      this.storageService.delete(apiContext),
      this.metric1.delete(apiContext),
      this.chart1.delete(apiContext),
      this.driveService.delete(apiContext),
      this.directory1.delete(apiContext),
      this.directory2.delete(apiContext),
      this.file1.delete(apiContext),
      this.file2.delete(apiContext),
      this.spreadsheet1.delete(apiContext),
      this.spreadsheet2.delete(apiContext),
      this.worksheet1.delete(apiContext),
      this.worksheet2.delete(apiContext),
    ];

    return await Promise.allSettled(promises);
  }

  static saveResponseData() {
    const responseData = {
      domain1: this.domain1.responseData,
      domain2: this.domain2.responseData,
      glossary1: this.glossary1.responseData,
      glossary2: this.glossary2.responseData,
      glossaryTerm1: this.glossaryTerm1.responseData,
      glossaryTerm2: this.glossaryTerm2.responseData,
      user1: this.user1.responseData,
      user2: this.user2.responseData,
      user3: this.user3.responseData,
      team1: this.team1.responseData,
      team2: this.team2.responseData,
      certificationTag1: this.certificationTag1.responseData,
      certificationTag2: this.certificationTag2.responseData,
      tierTag1: this.tierTag1.responseData,
      classification1: this.classification1.responseData,
      tag1: this.tag1.responseData,
      dataProduct1: this.dataProduct1.responseData,
      dataProduct2: this.dataProduct2.responseData,
      dataProduct3: this.dataProduct3.responseData,
      table1: this.table1.get(),
      table2: this.table2.get(),
      topic1: this.topic1.get(),
      topic2: this.topic2.get(),
      dashboard1: this.dashboard1.get(),
      dashboard2: this.dashboard2.get(),
      mlModel1: this.mlModel1.get(),
      mlModel2: this.mlModel2.get(),
      pipeline1: this.pipeline1.get(),
      pipeline2: this.pipeline2.get(),
      dashboardDataModel1: this.dashboardDataModel1.get(),
      dashboardDataModel2: this.dashboardDataModel2.get(),
      apiCollection1: this.apiCollection1.get(),
      apiCollection2: this.apiCollection2.get(),
      apiEndpoint1: this.apiEndpoint1.get(),
      apiEndpoint2: this.apiEndpoint2.get(),
      storedProcedure1: this.storedProcedure1.get(),
      storedProcedure2: this.storedProcedure2.get(),
      searchIndex1: this.searchIndex1.get(),
      searchIndex2: this.searchIndex2.get(),
      container1: this.container1.get(),
      container2: this.container2.get(),
      databaseService: this.databaseService.get(),
      database: this.database.get(),
      databaseSchema: this.databaseSchema.get(),
      apiService: this.apiService.get(),
      dashboardService: this.dashboardService.get(),
      messagingService: this.messagingService.get(),
      mlmodelService: this.mlmodelService.get(),
      pipelineService: this.pipelineService.get(),
      searchIndexService: this.searchIndexService.get(),
      storageService: this.storageService.get(),
      driveService: this.driveService.get(),
      metric1: this.metric1.get(),
      chart1: this.chart1.get(),
      directory1: this.directory1.get(),
      directory2: this.directory2.get(),
      file1: this.file1.get(),
      file2: this.file2.get(),
      spreadsheet1: this.spreadsheet1.get(),
      spreadsheet2: this.spreadsheet2.get(),
      worksheet1: this.worksheet1.get(),
      worksheet2: this.worksheet2.get(),
    };

    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'output',
      'entity-response-data.json'
    );
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(responseData, null, 2), {
      flag: 'w',
    });
  }

  static loadResponseData() {
    try {
      const filePath = path.join(
        __dirname,
        '..',
        '..',
        'output',
        'entity-response-data.json'
      );

      if (fs.existsSync(filePath)) {
        const responseData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (responseData.domain1) {
          this.domain1.responseData = responseData.domain1;
        }
        if (responseData.domain2) {
          this.domain2.responseData = responseData.domain2;
        }
        if (responseData.glossary1) {
          this.glossary1.responseData = responseData.glossary1;
        }
        if (responseData.glossary2) {
          this.glossary2.responseData = responseData.glossary2;
        }
        if (responseData.glossaryTerm1) {
          this.glossaryTerm1.responseData = responseData.glossaryTerm1;
        }
        if (responseData.glossaryTerm2) {
          this.glossaryTerm2.responseData = responseData.glossaryTerm2;
        }
        if (responseData.user1) {
          this.user1.responseData = responseData.user1;
        }
        if (responseData.user2) {
          this.user2.responseData = responseData.user2;
        }
        if (responseData.user3) {
          this.user3.responseData = responseData.user3;
        }
        if (responseData.team1) {
          this.team1.responseData = responseData.team1;
        }
        if (responseData.team2) {
          this.team2.responseData = responseData.team2;
        }
        if (responseData.certificationTag1) {
          this.certificationTag1.responseData = responseData.certificationTag1;
        }
        if (responseData.certificationTag2) {
          this.certificationTag2.responseData = responseData.certificationTag2;
        }
        if (responseData.tierTag1) {
          this.tierTag1.responseData = responseData.tierTag1;
        }
        if (responseData.classification1) {
          this.classification1.responseData = responseData.classification1;
        }
        if (responseData.tag1) {
          this.tag1.responseData = responseData.tag1;
        }
        if (responseData.dataProduct1) {
          this.dataProduct1.responseData = responseData.dataProduct1;
        }
        if (responseData.dataProduct2) {
          this.dataProduct2.responseData = responseData.dataProduct2;
        }
        if (responseData.dataProduct3) {
          this.dataProduct3.responseData = responseData.dataProduct3;
        }
        if (responseData.table1) {
          this.table1.set(responseData.table1);
        }
        if (responseData.table2) {
          this.table2.set(responseData.table2);
        }
        if (responseData.topic1) {
          this.topic1.set(responseData.topic1);
        }
        if (responseData.topic2) {
          this.topic2.set(responseData.topic2);
        }
        if (responseData.dashboard1) {
          this.dashboard1.set(responseData.dashboard1);
        }
        if (responseData.dashboard2) {
          this.dashboard2.set(responseData.dashboard2);
        }
        if (responseData.mlModel1) {
          this.mlModel1.set(responseData.mlModel1);
        }
        if (responseData.mlModel2) {
          this.mlModel2.set(responseData.mlModel2);
        }
        if (responseData.pipeline1) {
          this.pipeline1.set(responseData.pipeline1);
        }
        if (responseData.pipeline2) {
          this.pipeline2.set(responseData.pipeline2);
        }
        if (responseData.dashboardDataModel1) {
          this.dashboardDataModel1.set(responseData.dashboardDataModel1);
        }
        if (responseData.dashboardDataModel2) {
          this.dashboardDataModel2.set(responseData.dashboardDataModel2);
        }
        if (responseData.apiCollection1) {
          this.apiCollection1.set(responseData.apiCollection1);
        }
        if (responseData.apiCollection2) {
          this.apiCollection2.set(responseData.apiCollection2);
        }
        if (responseData.apiEndpoint1) {
          this.apiEndpoint1.set(responseData.apiEndpoint1);
        }
        if (responseData.apiEndpoint2) {
          this.apiEndpoint2.set(responseData.apiEndpoint2);
        }
        if (responseData.storedProcedure1) {
          this.storedProcedure1.set(responseData.storedProcedure1);
        }
        if (responseData.storedProcedure2) {
          this.storedProcedure2.set(responseData.storedProcedure2);
        }
        if (responseData.searchIndex1) {
          this.searchIndex1.set(responseData.searchIndex1);
        }
        if (responseData.searchIndex2) {
          this.searchIndex2.set(responseData.searchIndex2);
        }
        if (responseData.container1) {
          this.container1.set(responseData.container1);
        }
        if (responseData.container2) {
          this.container2.set(responseData.container2);
        }
        if (responseData.databaseService) {
          this.databaseService.set(responseData.databaseService);
        }
        if (responseData.database) {
          this.database.set(responseData.database);
        }
        if (responseData.databaseSchema) {
          this.databaseSchema.set(responseData.databaseSchema);
        }
        if (responseData.apiService) {
          this.apiService.set(responseData.apiService);
        }
        if (responseData.dashboardService) {
          this.dashboardService.set(responseData.dashboardService);
        }
        if (responseData.messagingService) {
          this.messagingService.set(responseData.messagingService);
        }
        if (responseData.mlmodelService) {
          this.mlmodelService.set(responseData.mlmodelService);
        }
        if (responseData.pipelineService) {
          this.pipelineService.set(responseData.pipelineService);
        }
        if (responseData.searchIndexService) {
          this.searchIndexService.set(responseData.searchIndexService);
        }
        if (responseData.storageService) {
          this.storageService.set(responseData.storageService);
        }
        if (responseData.driveService) {
          this.driveService.set(responseData.driveService);
        }
        if (responseData.metric1) {
          this.metric1.set(responseData.metric1);
        }
        if (responseData.chart1) {
          this.chart1.set(responseData.chart1);
        }
        if (responseData.directory1) {
          this.directory1.set(responseData.directory1);
        }
        if (responseData.directory2) {
          this.directory2.set(responseData.directory2);
        }
        if (responseData.file1) {
          this.file1.set(responseData.file1);
        }
        if (responseData.file2) {
          this.file2.set(responseData.file2);
        }
        if (responseData.spreadsheet1) {
          this.spreadsheet1.set(responseData.spreadsheet1);
        }
        if (responseData.spreadsheet2) {
          this.spreadsheet2.set(responseData.spreadsheet2);
        }
        if (responseData.worksheet1) {
          this.worksheet1.set(responseData.worksheet1);
        }
        if (responseData.worksheet2) {
          this.worksheet2.set(responseData.worksheet2);
        }
      }
    } catch (error) {
      // Silently fail if file doesn't exist or can't be read
    }
  }
}

// Load response data from file when the module is imported
EntityDataClass.loadResponseData();
