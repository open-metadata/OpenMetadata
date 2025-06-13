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
 * Resource descriptor
 */
export interface ResourceDescriptor {
    /**
     * Name of the resource. For entity related resources, resource name is same as the entity
     * name. Some resources such as lineage are not entities but are resources.
     */
    name?: string;
    /**
     * List of operations supported by the resource.
     */
    operations?: Operation[];
}

/**
 * This schema defines all possible operations on metadata of entities in OpenMetadata.
 */
export enum Operation {
    All = "All",
    Create = "Create",
    CreateIngestionPipelineAutomator = "CreateIngestionPipelineAutomator",
    CreateScim = "CreateScim",
    Delete = "Delete",
    DeleteScim = "DeleteScim",
    DeleteTestCaseFailedRowsSample = "DeleteTestCaseFailedRowsSample",
    Deploy = "Deploy",
    EditAll = "EditAll",
    EditCertification = "EditCertification",
    EditCustomFields = "EditCustomFields",
    EditDataProfile = "EditDataProfile",
    EditDescription = "EditDescription",
    EditDisplayName = "EditDisplayName",
    EditEntityRelationship = "EditEntityRelationship",
    EditGlossaryTerms = "EditGlossaryTerms",
    EditIngestionPipelineStatus = "EditIngestionPipelineStatus",
    EditKnowledgePanel = "EditKnowledgePanel",
    EditLifeCycle = "EditLifeCycle",
    EditLineage = "EditLineage",
    EditOwners = "EditOwners",
    EditPage = "EditPage",
    EditPolicy = "EditPolicy",
    EditQueries = "EditQueries",
    EditReviewers = "EditReviewers",
    EditRole = "EditRole",
    EditSampleData = "EditSampleData",
    EditScim = "EditScim",
    EditStatus = "EditStatus",
    EditTags = "EditTags",
    EditTeams = "EditTeams",
    EditTests = "EditTests",
    EditTier = "EditTier",
    EditUsage = "EditUsage",
    EditUsers = "EditUsers",
    GenerateToken = "GenerateToken",
    Kill = "Kill",
    Trigger = "Trigger",
    ViewAll = "ViewAll",
    ViewBasic = "ViewBasic",
    ViewDataProfile = "ViewDataProfile",
    ViewProfilerGlobalConfiguration = "ViewProfilerGlobalConfiguration",
    ViewQueries = "ViewQueries",
    ViewSampleData = "ViewSampleData",
    ViewScim = "ViewScim",
    ViewTestCaseFailedRowsSample = "ViewTestCaseFailedRowsSample",
    ViewTests = "ViewTests",
    ViewUsage = "ViewUsage",
}
