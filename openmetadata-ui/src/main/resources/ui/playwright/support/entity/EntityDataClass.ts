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
import { getCIJobId, resetSeed } from '../../utils/common';
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
import { EntityDataClassCreationConfig } from './EntityDataClass.interface';
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

// Reset seed before initializing entities to ensure deterministic data across all workers
resetSeed();

// Get unique identifier for this test execution (only used in CI to avoid conflicts)
const JOB_ID = getCIJobId();
const SUFFIX = JOB_ID ? `-${JOB_ID}` : ''; // Only add suffix in CI

export class EntityDataClass {
  static readonly domain1 = new Domain();
  static readonly domain2 = new Domain();
  static readonly glossary1 = new Glossary();
  static readonly glossary2 = new Glossary();
  static readonly glossaryTerm1 = new GlossaryTerm(this.glossary1);
  static readonly glossaryTerm2 = new GlossaryTerm(this.glossary2);
  static readonly user1 = new UserClass({
    email: `pw.user.one${SUFFIX}@example.com`,
    firstName: 'PWUser',
    lastName: `One${SUFFIX}`,
    password: 'User@OMD123',
  });
  static readonly user2 = new UserClass({
    email: `pw.user.two${SUFFIX}@example.com`,
    firstName: 'PWUser',
    lastName: `Two${SUFFIX}`,
    password: 'User@OMD123',
  });
  static readonly user3 = new UserClass({
    email: `pw.user.three${SUFFIX}@example.com`,
    firstName: 'PWUser',
    lastName: `Three${SUFFIX}`,
    password: 'User@OMD123',
  });
  static readonly team1 = new TeamClass({
    name: `PW%team-1${SUFFIX}`,
    displayName: `PW Team 1${SUFFIX}`,
    description: 'playwright team 1 description',
    teamType: 'Group',
    users: [],
    policies: [],
  });
  static readonly team2 = new TeamClass({
    name: `PW%team-2${SUFFIX}`,
    displayName: `PW Team 2${SUFFIX}`,
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
            this.certificationTag1.create(apiContext),
            this.certificationTag2.create(apiContext),
            this.tierTag1.create(apiContext),
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
    if (creationConfig?.all || creationConfig?.metric) {
      promises.push(this.metric1.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.chart) {
      promises.push(this.chart1.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.driveService) {
      promises.push(this.driveService.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.directory) {
      promises.push(this.directory1.create(apiContext));
      promises.push(this.directory2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.file) {
      promises.push(this.file1.create(apiContext));
      promises.push(this.file2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.spreadsheet) {
      promises.push(this.spreadsheet1.create(apiContext));
      promises.push(this.spreadsheet2.create(apiContext));
    }
    if (creationConfig?.all || creationConfig?.worksheet) {
      promises.push(this.worksheet1.create(apiContext));
      promises.push(this.worksheet2.create(apiContext));
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
            this.certificationTag1.delete(apiContext),
            this.certificationTag2.delete(apiContext),
            this.tierTag1.delete(apiContext),
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
    if (creationConfig?.all || creationConfig?.metric) {
      promises.push(this.metric1.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.chart) {
      promises.push(this.chart1.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.driveService) {
      promises.push(this.driveService.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.directory) {
      promises.push(this.directory1.delete(apiContext));
      promises.push(this.directory2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.file) {
      promises.push(this.file1.delete(apiContext));
      promises.push(this.file2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.spreadsheet) {
      promises.push(this.spreadsheet1.delete(apiContext));
      promises.push(this.spreadsheet2.delete(apiContext));
    }
    if (creationConfig?.all || creationConfig?.worksheet) {
      promises.push(this.worksheet1.delete(apiContext));
      promises.push(this.worksheet2.delete(apiContext));
    }

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

    fs.writeFileSync(filePath, JSON.stringify(responseData, null, 2));
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
      }
    } catch (error) {
      // Silently fail if file doesn't exist or can't be read
    }
  }
}

// Load response data from file when the module is imported
EntityDataClass.loadResponseData();
