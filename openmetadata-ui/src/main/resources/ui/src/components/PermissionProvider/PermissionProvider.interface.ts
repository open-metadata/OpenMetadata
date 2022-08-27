import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';

export type UIPermission = {
  [key in ResourceEntity]: OperationPermission;
};

export type OperationPermission = {
  [key in Operation]: boolean;
};

export enum ResourceEntity {
  ALL = 'all',
  BOT = 'bot',
  CHART = 'chart',
  DASHBOARD = 'dashboard',
  DASHBOARDSERVICE = 'dashboardService',
  DATABASE = 'database',
  DATABASESCHEMA = 'databaseSchema',
  DATABASESERVICE = 'databaseService',
  EVENTS = 'events',
  FEED = 'feed',
  GLOSSARY = 'glossary',
  GLOSSARYTERM = 'glossaryTerm',
  INGESTIONPIPELINE = 'ingestionPipeline',
  LOCATION = 'location',
  MESSAGINGSERVICE = 'messagingService',
  METRICS = 'metrics',
  MLMODEL = 'mlmodel',
  MLMODELSERVICE = 'mlmodelService',
  PIPELINE = 'pipeline',
  PIPELINESERVICE = 'pipelineService',
  POLICY = 'policy',
  REPORT = 'report',
  ROLE = 'role',
  STORAGESERVICE = 'storageService',
  TABLE = 'table',
  TAG = 'tag',
  TAGCATEGORY = 'tagCategory',
  TEAM = 'team',
  TESTCASE = 'testCase',
  TESTDEFINITION = 'testDefinition',
  TESTSUITE = 'testSuite',
  TOPIC = 'topic',
  TYPE = 'type',
  USER = 'user',
  WEBHOOK = 'webhook',
}
