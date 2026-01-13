/*
 *  Copyright 2024 Collate.
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
import TabsLabel from '../../../components/common/TabsLabel/TabsLabel.component';
import { TestCaseFormType } from '../../../components/DataQuality/AddDataQualityTest/AddDataQualityTest.interface';
import TestCaseIncidentTab from '../../../components/DataQuality/IncidentManager/TestCaseIncidentTab/TestCaseIncidentTab.component';
import TestCaseResultTab from '../../../components/DataQuality/IncidentManager/TestCaseResultTab/TestCaseResultTab.component';
import { CreateTestCase } from '../../../generated/api/tests/createTestCase';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { createTestCaseParameters } from '../../../utils/DataQuality/DataQualityUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { TestCasePageTabs } from '../IncidentManager.interface';
import { TestCaseClassBase, TestCaseTabType } from './TestCaseClassBase';

describe('TestCaseClassBase', () => {
  let testCaseClassBase: TestCaseClassBase;

  beforeEach(() => {
    testCaseClassBase = new TestCaseClassBase();
  });

  it('should set showSqlQueryTab to false by default', () => {
    expect(testCaseClassBase.showSqlQueryTab).toBe(false);
  });

  it('should set showSqlQueryTab correctly', () => {
    testCaseClassBase.setShowSqlQueryTab(true);

    expect(testCaseClassBase.showSqlQueryTab).toBe(true);
  });

  it('should return an array of TestCaseTabType', () => {
    const openTaskCount = 5;
    const expectedTabs: TestCaseTabType[] = [
      {
        LabelComponent: TabsLabel,
        labelProps: {
          id: 'test-case-result',
          name: i18n.t('label.test-case-result'),
        },
        Tab: TestCaseResultTab,
        key: TestCasePageTabs.TEST_CASE_RESULTS,
      },
      {
        LabelComponent: TabsLabel,
        labelProps: {
          id: 'incident',
          name: i18n.t('label.incident'),
          count: openTaskCount,
        },
        Tab: TestCaseIncidentTab,
        key: TestCasePageTabs.ISSUES,
      },
    ];

    const result = testCaseClassBase.getTab(openTaskCount, false);

    expect(result).toEqual(expectedTabs);
  });

  it('should return an array of fields', () => {
    const expectedFields = [
      'testSuite',
      'testCaseResult',
      'testDefinition',
      'owners',
      'incidentId',
      'tags',
    ];

    const result = testCaseClassBase.getFields();

    expect(result).toEqual(expectedFields);
  });

  it('should return an empty array for createFormAdditionalFields', () => {
    const result = testCaseClassBase.createFormAdditionalFields(false);

    expect(result).toEqual([]);
  });

  it('should return an empty object for initialFormValues', () => {
    const result = testCaseClassBase.initialFormValues();

    expect(result).toEqual({});
  });

  it('should return a partial CreateTestCase object', () => {
    const value = {
      params: { columnNames: 'id', ordered: 'true' },
    } as unknown as TestCaseFormType;
    const selectedDefinition = {
      parameterDefinition: [
        {
          name: 'columnNames',
          dataType: 'STRING',
        },
        {
          name: 'ordered',
          dataType: 'BOOLEAN',
        },
      ],
    };
    const expectedCreateTestCase: Partial<CreateTestCase> = {
      parameterValues: createTestCaseParameters(
        value.params,
        selectedDefinition as TestDefinition
      ),
    };

    const result = testCaseClassBase.getCreateTestCaseObject(
      value,
      selectedDefinition as TestDefinition
    );

    expect(result).toEqual(expectedCreateTestCase);
  });
});
