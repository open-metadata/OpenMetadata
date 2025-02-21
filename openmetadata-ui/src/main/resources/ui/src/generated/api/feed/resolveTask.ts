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
 * Resolve Task request
 */
export interface ResolveTask {
    /**
     * The new value object that needs to be updated to resolve the task.
     */
    newValue: string;
    /**
     * Reason of Test Case resolution.
     */
    testCaseFailureReason?: TestCaseFailureReasonType;
    /**
     * Fully qualified name of the test case.
     */
    testCaseFQN?: string;
}

/**
 * Reason of Test Case resolution.
 *
 * Reason of Test Case initial failure.
 */
export enum TestCaseFailureReasonType {
    Duplicates = "Duplicates",
    FalsePositive = "FalsePositive",
    MissingData = "MissingData",
    Other = "Other",
    OutOfBounds = "OutOfBounds",
}
