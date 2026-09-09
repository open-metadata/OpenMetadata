/*
 *  Copyright 2026 Collate.
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
 * Quarantine entries that a source `{ tag: '@quarantine' }` cannot express.
 *
 * A tag sits on a `test()` call, so tagging a loop-generated test quarantines
 * EVERY variant that loop produces — `Entity.spec.ts › Spreadsheet › Tier Add,
 * Update and Remove` is 1 of 12 entity variants, and `CustomProperties ›
 * table › Date` 1 of dozens. Matching the full title instead targets the one
 * variant the evidence is actually about, which is what QUARANTINE.md's
 * "counted per generated variant" threshold requires.
 *
 * Playwright greps against `<spec path> <describe titles> <test title>` joined
 * by single spaces; `playwright.config.ts` builds that string from `spec` +
 * `test` below, so write `test` exactly as the report prints it, with ` › `
 * between describe levels and NO trailing `@tag` suffixes.
 *
 * `runs` is how many of the 56 sampled merge_group runs the test flaked in —
 * evidence, not decoration. Delete the entry when the test is fixed.
 */
export interface QuarantineEntry {
  spec: string;
  test: string;
  runs: number;
}

export const QUARANTINE_LIST: QuarantineEntry[] = [
  {
    spec: 'Pages/TasksUIFlow.spec.ts',
    test: 'Tasks UI Flow - Multi Entity Tests › Create and resolve description task for Pipeline via UI',
    runs: 33,
  },
  {
    spec: 'Pages/TasksUIFlow.spec.ts',
    test: 'Tasks UI Flow - Multi Entity Tests › Create and reject tag task for Dashboard via UI',
    runs: 19,
  },
  {
    spec: 'Features/PersonaAIContext.spec.ts',
    test: 'Persona AI Context › View in Explore link href reflects the selected entity type',
    runs: 9,
  },
  {
    spec: 'Features/DataQuality/TableLevelTests.spec.ts',
    test: 'Table Level Data Quality Test Cases › Custom SQL Query',
    runs: 7,
  },
  {
    spec: 'Features/GlobalPageSize.spec.ts',
    test: 'Table & Data Model columns table pagination › Page size should persist across different pages',
    runs: 7,
  },
  {
    spec: 'Pages/ExplorePageRightPanel.spec.ts',
    test: 'Right Panel Test Suite › Explore page right panel tests › Overview panel - Deleted entity verification › Should verify deleted tag not visible in tag selection for container',
    runs: 7,
  },
  {
    spec: 'Flow/CustomizeWidgets.spec.ts',
    test: 'KPI Widget',
    runs: 6,
  },
  {
    spec: 'Features/DomainTierCertificationVoting.spec.ts',
    test: 'Domain & DataProduct - Tier, Certification, and Voting › Admin operations › Domain - Tier assign, update, and remove',
    runs: 5,
  },
  {
    spec: 'Pages/Domains.spec.ts',
    test: 'Domains › Verify duplicate domain creation',
    runs: 4,
  },
  {
    spec: 'Features/ActivityFeed.spec.ts',
    test: 'ActivityFeed: activity + conversation merge (regression #25894) › All badge, header and rendered list agree on the count',
    runs: 3,
  },
  {
    spec: 'Features/ContextCenterMemories.spec.ts',
    test: 'Context Center - Memories › Edit Memory — Each Field › adding a linked asset in edit mode shows entity badge on the row',
    runs: 3,
  },
  {
    spec: 'Features/DataProductPersonaCustomization.spec.ts',
    test: 'Data Product Persona customization › Data Product - customization should work',
    runs: 3,
  },
  {
    spec: 'Features/DataQuality/TestLibrary.spec.ts',
    test: 'Test Library › should handle external test definitions with read-only fields',
    runs: 3,
  },
  {
    spec: 'Features/Topic.spec.ts',
    test: 'Topic entity specific tests  › Copy field link should have valid URL format',
    runs: 3,
  },
  {
    spec: 'Flow/ExploreAggregationCountsMatching.spec.ts',
    test: 'Explore Aggregation Counts Matching › should verify left panel counts and tab search results for normal search',
    runs: 3,
  },
  {
    spec: 'Pages/CustomProperties.spec.ts',
    test: 'Add update and delete custom properties for table › Date',
    runs: 3,
  },
  {
    spec: 'Pages/DataContracts.spec.ts',
    test: 'Data Contracts With Persona Chart › Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona',
    runs: 3,
  },
  {
    spec: 'Pages/DataProductAndSubdomains.spec.ts',
    test: 'Data Product Comprehensive Tests › Create data product via UI with description',
    runs: 3,
  },
  {
    spec: 'Pages/DomainDataProductsRightPanel.spec.ts',
    test: 'Domain Data Products Tab - Right Panel › Should edit description for data product from domain context',
    runs: 3,
  },
  {
    spec: 'Pages/Domains.spec.ts',
    test: 'Domains › Follow/unfollow subdomain and create nested sub domain',
    runs: 3,
  },
  {
    spec: 'Pages/Domains.spec.ts',
    test: 'Domains › Create domains and add assets',
    runs: 3,
  },
  {
    spec: 'Pages/ExplorePageRightPanel.spec.ts',
    test: 'Right Panel Test Suite › Explore page right panel tests › Overview panel CRUD and Removal operations › Should perform CRUD and Removal operations for dashboard',
    runs: 3,
  },
  {
    spec: 'Features/ActivityAPI.spec.ts',
    test: 'Activity API - Comments › creates exactly one reply and isolates activities with the same about',
    runs: 2,
  },
  {
    spec: 'Features/ActivityFeed.spec.ts',
    test: 'FeedWidget on landing page › emoji reactions can be added and toggled off on a feed card',
    runs: 2,
  },
  {
    spec: 'Features/ColumnBulkOperations.spec.ts',
    test: 'Column Bulk Operations - Bulk Update Flow › should update display name and propagate to all occurrences',
    runs: 2,
  },
  {
    spec: 'Features/DataProductDomainMigration.spec.ts',
    test: 'Data Product Domain Migration › Data product remains visible after moving domains and deleting the original domain',
    runs: 2,
  },
  {
    spec: 'Features/DataQuality/IncidentManagerDateFilter.spec.ts',
    test: 'Incident Manager Date Filter › Date picker shows placeholder when no date is selected',
    runs: 2,
  },
  {
    spec: 'Features/DomainFilterQueryFilter.spec.ts',
    test: 'Domain Filter - User Behavior Tests › Domain assets tab should NOT show assets from other domains',
    runs: 2,
  },
  {
    spec: 'Features/DomainFilterQueryFilter.spec.ts',
    test: 'Domain Filter - User Behavior Tests › Domain page assets tab should show only domain assets',
    runs: 2,
  },
  {
    spec: 'Features/DomainTierCertificationVoting.spec.ts',
    test: 'Domain & DataProduct - Tier, Certification, and Voting › Admin operations › Domain - Certification assign, update, and remove',
    runs: 2,
  },
  {
    spec: 'Features/DomainTierCertificationVoting.spec.ts',
    test: 'Domain & DataProduct - Tier, Certification, and Voting › Admin operations › Domain - UpVote and DownVote',
    runs: 2,
  },
  {
    spec: 'Features/Glossary/GlossaryAdvancedOperations.spec.ts',
    test: 'Glossary Advanced Operations › should show error when glossary name exceeds limit',
    runs: 2,
  },
  {
    spec: 'Features/Glossary/GlossaryCRUDOperations.spec.ts',
    test: 'Glossary CRUD Operations › should create glossary with mutually exclusive enabled',
    runs: 2,
  },
  {
    spec: 'Features/Glossary/GlossaryHierarchy.spec.ts',
    test: 'Glossary Hierarchy › should move term with children to different glossary',
    runs: 2,
  },
  {
    spec: 'Features/OntologyStudioIntegration.spec.ts',
    test: 'Ontology Studio - Data Mode Asset Cards › data mode renders tagged assets from the ontology data response',
    runs: 2,
  },
  {
    spec: 'Features/PersonaAIContextRules.spec.ts',
    test: 'Persona AI Context — Rule Builder › Persona AI Context — Filter validation › changing entity type clears an incomplete filter and unblocks save',
    runs: 2,
  },
  {
    spec: 'Features/RestoreEntityInheritedFields.spec.ts',
    test: 'Table › Validate restore with Inherited domain and data products assigned',
    runs: 2,
  },
  {
    spec: 'Features/RestoreEntityInheritedFields.spec.ts',
    test: 'SearchIndex › Validate restore with Inherited domain and data products assigned',
    runs: 2,
  },
  {
    spec: 'Features/Workflows/WorkflowOssRestrictions.spec.ts',
    test: 'OSS Workflow Capabilities › Test workflow — start node config (event-based) › exclude-fields-select is enabled in OSS',
    runs: 2,
  },
  {
    spec: 'Features/Workflows/WorkflowOssRestrictions.spec.ts',
    test: 'OSS Workflow Capabilities › Test workflow — edit mode: header controls › cancel workflow opens confirmation modal; close-without-saving returns to view mode',
    runs: 2,
  },
  {
    spec: 'Flow/ConditionalPermissions.spec.ts',
    test: 'User with matchAnyTag permission can only view Pipeline Services with the tag',
    runs: 2,
  },
  {
    spec: 'Flow/CustomizeWidgets.spec.ts',
    test: 'Data Assets Widget',
    runs: 2,
  },
  {
    spec: 'Flow/ExploreDiscovery.spec.ts',
    test: 'Explore Assets Discovery › Should not display deleted assets when showDeleted is checked but deleted is false in queryFilter',
    runs: 2,
  },
  {
    spec: 'Pages/CustomProperties.spec.ts',
    test: 'Add update and delete custom properties for table › Timestamp',
    runs: 2,
  },
  {
    spec: 'Pages/CustomProperties.spec.ts',
    test: 'Add update and delete custom properties for table › Time',
    runs: 2,
  },
  {
    spec: 'Pages/DataContractsSemanticRules.spec.ts',
    test: 'Data Contracts Semantics Rule Description › Validate Description Rule Is_Set',
    runs: 2,
  },
  {
    spec: 'Pages/DomainDataProductsRightPanel.spec.ts',
    test: 'Domain Data Products Tab - Right Panel › Should display overview tab for data product',
    runs: 2,
  },
  {
    spec: 'Pages/Domains.spec.ts',
    test: 'Domains › Verify domain and subdomain asset count accuracy',
    runs: 2,
  },
  {
    spec: 'Pages/Entity.spec.ts',
    test: 'Spreadsheet › Tier Add, Update and Remove',
    runs: 2,
  },
  {
    spec: 'Pages/Entity.spec.ts',
    test: 'Pipeline › Announcement create, edit & delete',
    runs: 2,
  },
  {
    spec: 'Pages/EntityDataConsumer.spec.ts',
    test: 'Topic › Tier Add, Update and Remove',
    runs: 2,
  },
  {
    spec: 'Pages/ExplorePageRightPanel.spec.ts',
    test: 'Right Panel Test Suite › Explore page right panel tests › Overview panel - Deleted entity verification › Should verify deleted tag not visible in tag selection for dashboardDataModel',
    runs: 2,
  },
  {
    spec: 'Pages/ExplorePageRightPanel.spec.ts',
    test: 'Right Panel Test Suite › Explore page right panel tests › Overview panel - Deleted entity verification › Should verify deleted glossary term not visible in selection for dashboardDataModel',
    runs: 2,
  },
  {
    spec: 'Pages/ExplorePageRightPanel.spec.ts',
    test: 'Right Panel Test Suite › Explore page right panel tests › Overview panel - Deleted entity verification › Should verify deleted tag not visible in tag selection for mlmodel',
    runs: 2,
  },
  {
    spec: 'Pages/ExplorePageRightPanel.spec.ts',
    test: 'Right Panel Test Suite › Explore page right panel tests › Overview panel - Deleted entity verification › Should verify deleted glossary term not visible in selection for searchIndex',
    runs: 2,
  },
  {
    spec: 'Pages/ExploreTree.spec.ts',
    test: 'Explore page › Copy field link button should copy the field URL to clipboard for APIEndpoint',
    runs: 2,
  },
  {
    spec: 'Pages/ExploreTree.spec.ts',
    test: 'Explore page › Check the listing of tags',
    runs: 2,
  },
  {
    spec: 'Pages/Glossary.spec.ts',
    test: 'Glossary tests › Async Delete - multiple deletes with mixed results',
    runs: 2,
  },
];
