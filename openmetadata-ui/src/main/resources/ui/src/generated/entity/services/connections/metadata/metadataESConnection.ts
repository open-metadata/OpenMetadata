/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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

/**
 * Metadata to ElasticSearch Connection Config
 */
export interface MetadataESConnection {
  /**
   * Include Dashboards for Indexing
   */
  includeDashboards?: boolean;
  /**
   * Include Database Services for Indexing
   */
  includeDatabaseServices?: boolean;
  /**
   * Include Glossary Terms for Indexing
   */
  includeGlossaryTerms?: boolean;
  /**
   * Include Messaging Services for Indexing
   */
  includeMessagingServices?: boolean;
  /**
   * Include Pipelines for Indexing
   */
  includePipelines?: boolean;
  /**
   * Include Pipeline Services for Indexing
   */
  includePipelineServices?: boolean;
  /**
   * Include Tags for Policy
   */
  includePolicy?: boolean;
  /**
   * Include Tables for Indexing
   */
  includeTables?: boolean;
  /**
   * Include Tags for Indexing
   */
  includeTags?: boolean;
  /**
   * Include Teams for Indexing
   */
  includeTeams?: boolean;
  /**
   * Include Topics for Indexing
   */
  includeTopics?: boolean;
  /**
   * Include Users for Indexing
   */
  includeUsers?: boolean;
  /**
   * Limit the number of records for Indexing.
   */
  limitRecords?: number;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: MetadataESType;
}

/**
 * Service Type
 *
 * Metadata to Elastic Search type
 */
export enum MetadataESType {
  MetadataES = 'MetadataES',
}
