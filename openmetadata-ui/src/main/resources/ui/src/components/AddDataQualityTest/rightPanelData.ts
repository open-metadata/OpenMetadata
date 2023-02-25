/*
 *  Copyright 2022 Collate.
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

/* eslint-disable max-len */

export const TEST_FORM_DATA = [
  {
    title: 'Select/Create Test Suite',
    body: 'A Test Suite is a container consisting of multiple but related test cases. With a Test Suite, you can easily deploy a pipeline to execute the Test Cases. Start by selecting an existing test suite or create a new test suite to create a table or column level test for an entity.',
  },
  {
    title: 'Create Test Case',
    body: 'To create a test case, add a unique name. Select a test type from the options provided. Fill in the details for the parameters that show up for a selected test type. Enter a description (optional).',
  },
  {
    title: 'Test Case Created Successfully',
    body: '{testCase} has been created successfully. View the Test Suite to check the details of the new created test case. This will be picked up in the next run.',
  },
  {
    title: 'Test Suite & Test Case Created Successfully',
    body: '{testSuite} & {testCase} has been created successfully. In the next step, you can schedule to ingest metadata at the desired frequency. You can also view the Test Suite to check the details of the new created test case.',
  },
];

export const TEST_PAGE_FORM_DATA = [
  {
    title: 'Create Test Suite',
    body: 'A Test Suite is a container consisting of multiple but related test cases. With a Test Suite, you can easily deploy a pipeline to execute the Test Cases. Start by selecting an existing test suite or create a new test suite to create a table or column level test for an entity.',
  },
  {
    title: 'Test Suite Created Successfully',
    body: '{testSuite} has been created successfully. In the next step, you can schedule to ingest metadata at the desired frequency. You can also view the Test Suite to check the details of the new created test case.',
  },
];

export const INGESTION_DATA = {
  title: 'Scheduler for Tests',
  body: 'The data quality tests can be scheduled to run at the desired frequency. The timezone is in UTC.',
};

export const addTestSuiteRightPanel = (
  step: number,
  isSuiteCreate?: boolean,
  data?: { testSuite: string; testCase: string }
) => {
  let message = TEST_FORM_DATA[step - 1];

  if (step === 3) {
    if (isSuiteCreate) {
      message = TEST_FORM_DATA[step];
      const updatedMessage = message.body
        .replace('{testSuite}', data?.testSuite || 'Test Suite')
        .replace('{testCase}', data?.testCase || 'Test Case');
      message.body = updatedMessage;
    } else {
      const updatedMessage = message.body.replace(
        '{testCase}',
        data?.testCase || 'Test Case'
      );
      message.body = updatedMessage;
    }
  }

  return message;
};

export const getRightPanelForAddTestSuitePage = (
  step: number,
  testSuite: string
) => {
  let message = TEST_PAGE_FORM_DATA[step - 1];
  if (step === 2) {
    message = TEST_PAGE_FORM_DATA[step - 1];
    message.body = message.body.replace('{testSuite}', testSuite);
  }

  return message;
};
