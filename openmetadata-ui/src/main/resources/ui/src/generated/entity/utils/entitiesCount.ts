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
/**
 * This schema defines Entities Count. This contains aggregated entities count.
 */
export interface EntitiesCount {
    /**
     * Dashboard Count
     */
    dashboardCount?: number;
    /**
     * Glossary Count
     */
    glossaryCount?: number;
    /**
     * Glossary Term Count
     */
    glossaryTermCount?: number;
    /**
     * MlModel Count
     */
    mlmodelCount?: number;
    /**
     * Pipeline Count
     */
    pipelineCount?: number;
    /**
     * Services Count
     */
    servicesCount?: number;
    /**
     * Storage Container Count
     */
    storageContainerCount?: number;
    /**
     * Table Count
     */
    tableCount?: number;
    /**
     * Team Count
     */
    teamCount?: number;
    /**
     * Test Suite Count
     */
    testSuiteCount?: number;
    /**
     * Topic Count
     */
    topicCount?: number;
    /**
     * User Count
     */
    userCount?: number;
}
