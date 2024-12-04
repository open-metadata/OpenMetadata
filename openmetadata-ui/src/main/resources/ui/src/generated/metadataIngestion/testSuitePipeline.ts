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
 * TestSuite Pipeline Configuration.
 */
export interface TestSuitePipeline {
    /**
     * Fully qualified name of the entity to be tested.
     */
    entityFullyQualifiedName: string;
    /**
     * Percentage of data or no. of rows we want to execute the profiler and tests on
     */
    profileSample?:      number;
    profileSampleType?:  ProfileSampleType;
    samplingMethodType?: SamplingMethodType;
    /**
     * List of test cases to be executed on the entity. If null, all test cases will be executed.
     */
    testCases?: string[];
    /**
     * Pipeline type
     */
    type: TestSuiteConfigType;
}

/**
 * Type of Profile Sample (percentage or rows)
 */
export enum ProfileSampleType {
    Percentage = "PERCENTAGE",
    Rows = "ROWS",
}

/**
 * Type of Sampling Method (BERNOULLI or SYSTEM)
 */
export enum SamplingMethodType {
    Bernoulli = "BERNOULLI",
    System = "SYSTEM",
}

/**
 * Pipeline type
 *
 * Pipeline Source Config Metadata Pipeline type
 */
export enum TestSuiteConfigType {
    TestSuite = "TestSuite",
}
