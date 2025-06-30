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
import { ReactElement } from 'react';
import TabsLabel from '../../../components/common/TabsLabel/TabsLabel.component';
import { TabsLabelProps } from '../../../components/common/TabsLabel/TabsLabel.interface';
import { TestCaseFormType } from '../../../components/DataQuality/AddDataQualityTest/AddDataQualityTest.interface';
import TestCaseIncidentTab from '../../../components/DataQuality/IncidentManager/TestCaseIncidentTab/TestCaseIncidentTab.component';
import TestCaseResultTab from '../../../components/DataQuality/IncidentManager/TestCaseResultTab/TestCaseResultTab.component';
import { TabSpecificField } from '../../../enums/entity.enum';
import { CreateTestCase } from '../../../generated/api/tests/createTestCase';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { FieldProp } from '../../../interface/FormUtils.interface';
import { createTestCaseParameters } from '../../../utils/DataQuality/DataQualityUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { TestCasePageTabs } from '../IncidentManager.interface';

export interface TestCaseTabType {
  LabelComponent: typeof TabsLabel;
  labelProps: TabsLabelProps;
  Tab: () => ReactElement;
  key: TestCasePageTabs;
}

class TestCaseClassBase {
  showSqlQueryTab: boolean;

  constructor() {
    this.showSqlQueryTab = false;
  }

  public getTab(
    openTaskCount: number,
    isVersionPage: boolean
  ): TestCaseTabType[] {
    return [
      {
        LabelComponent: TabsLabel,
        labelProps: {
          id: 'test-case-result',
          name: i18n.t('label.test-case-result'),
        },
        Tab: TestCaseResultTab,
        key: TestCasePageTabs.TEST_CASE_RESULTS,
      },
      ...(isVersionPage
        ? []
        : [
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
          ]),
    ];
  }

  setShowSqlQueryTab(showSqlQueryTab: boolean) {
    this.showSqlQueryTab = showSqlQueryTab;
  }

  public getFields(): string[] {
    return [
      TabSpecificField.TESTSUITE,
      TabSpecificField.TEST_CASE_RESULT,
      TabSpecificField.TEST_DEFINITION,
      TabSpecificField.OWNERS,
      TabSpecificField.INCIDENT_ID,
      TabSpecificField.TAGS,
    ];
  }

  public createFormAdditionalFields(
    _supportsDynamicAssertion: boolean
  ): FieldProp[] {
    return [];
  }

  public initialFormValues(): Record<string, unknown> {
    return {};
  }

  public getCreateTestCaseObject(
    value: TestCaseFormType,
    selectedDefinition?: TestDefinition
  ): Partial<CreateTestCase> {
    return {
      parameterValues: createTestCaseParameters(
        value.params,
        selectedDefinition
      ),
    };
  }
}

const testCaseClassBase = new TestCaseClassBase();

export default testCaseClassBase;
export { TestCaseClassBase };
