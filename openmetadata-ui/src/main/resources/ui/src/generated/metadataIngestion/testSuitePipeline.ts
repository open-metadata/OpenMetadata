/**
 * TestSuite Pipeline Configuration.
 */
export interface TestSuitePipeline {
    /**
     * Fully qualified name of the entity to be tested.
     */
    entityFullyQualifiedName?: string;
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
