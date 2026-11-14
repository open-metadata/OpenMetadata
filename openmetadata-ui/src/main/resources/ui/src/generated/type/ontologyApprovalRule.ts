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
 * How many of an ontology's reviewers must approve a release review. AnyReviewer decides on
 * the first approval. AllReviewers waits for every reviewer entry; a reviewer team counts
 * once and any member covers it. Frozen into the review task when a review is requested.
 */
export enum OntologyApprovalRule {
    AllReviewers = "AllReviewers",
    AnyReviewer = "AnyReviewer",
}
