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
 * Lifecycle stage of a context memory. Unprocessed awaits reconciliation; only Approved
 * memories ground new memories and agent responses. Deprecated and Rejected remain readable
 * legacy retirement stages.
 */
export enum ContextMemoryStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    Invalidated = "Invalidated",
    Rejected = "Rejected",
    Superseded = "Superseded",
    Unprocessed = "Unprocessed",
}
