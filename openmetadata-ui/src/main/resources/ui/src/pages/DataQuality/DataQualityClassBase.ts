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
import { ReactComponent as TestCaseIcon } from '../../assets/svg/all-activity-v2.svg';
import { ReactComponent as TestSuiteIcon } from '../../assets/svg/icon-test-suite.svg';
import { TestCases } from '../../components/DataQuality/TestCases/TestCases.component';
import { TestSuites } from '../../components/DataQuality/TestSuite/TestSuiteList/TestSuites.component';
import i18n from '../../utils/i18next/LocalUtil';
import { DataQualityPageTabs } from './DataQualityPage.interface';

export type DataQualityLeftSideBarType = {
  key: DataQualityPageTabs;
  id: string;
  label: string;
  description: string;
  icon: SvgComponent;
  iconProps: React.SVGProps<SVGSVGElement>;
};

class DataQualityClassBase {
  public getLeftSideBar(): DataQualityLeftSideBarType[] {
    return [
      {
        key: DataQualityPageTabs.TEST_CASES,
        label: i18n.t('label.by-entity', {
          entity: i18n.t('label.test-case-plural'),
        }),
        id: 'by-test-cases',
        description: i18n.t('label.data-health-by-entity', {
          entity: i18n.t('label.test-case-plural'),
        }),
        icon: TestCaseIcon,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
      {
        key: DataQualityPageTabs.TEST_SUITES,
        label: i18n.t('label.by-entity', {
          entity: i18n.t('label.test-suite-plural'),
        }),
        description: i18n.t('label.data-health-by-entity', {
          entity: i18n.t('label.test-suite-plural'),
        }),
        id: 'by-test-suites',
        icon: TestSuiteIcon,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
    ];
  }

  public getDataQualityTab() {
    return [
      {
        key: DataQualityPageTabs.TEST_CASES,
        component: TestCases,
        label: i18n.t('label.test-case-plural'),
      },
      {
        key: DataQualityPageTabs.TEST_SUITES,
        component: TestSuites,
        label: i18n.t('label.test-suite-plural'),
      },
    ];
  }

  public getDefaultActiveTab(): DataQualityPageTabs {
    return DataQualityPageTabs.TEST_CASES;
  }

  public getExportDataQualityDashboardButton(
    _activeTab: DataQualityPageTabs
  ): React.ReactNode {
    return null;
  }
}

const dataQualityClassBase = new DataQualityClassBase();

export default dataQualityClassBase;
export { DataQualityClassBase };
