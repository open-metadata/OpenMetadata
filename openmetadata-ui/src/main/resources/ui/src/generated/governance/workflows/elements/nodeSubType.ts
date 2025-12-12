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
 * SubType of the Node.
 */
export enum NodeSubType {
    CheckEntityAttributesTask = "checkEntityAttributesTask",
    CreateAndRunIngestionPipelineTask = "createAndRunIngestionPipelineTask",
    DataCompletenessTask = "dataCompletenessTask",
    EndEvent = "endEvent",
    ParallelGateway = "parallelGateway",
    RollbackEntityTask = "rollbackEntityTask",
    RunAppTask = "runAppTask",
    SetEntityAttributeTask = "setEntityAttributeTask",
    SetEntityCertificationTask = "setEntityCertificationTask",
    SetGlossaryTermStatusTask = "setGlossaryTermStatusTask",
    StartEvent = "startEvent",
    UserApprovalTask = "userApprovalTask",
}
