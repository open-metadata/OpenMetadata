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

import { Button, Dropdown, Tabs } from '@openmetadata/ui-core-components';
import { ChevronDown, Plus, Upload01 } from '@untitledui/icons';
import { ComponentType, lazy, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ExportTypes } from '../../../constants/Export.constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { TestCase } from '../../../generated/tests/testCase';
import { TestSuite } from '../../../generated/tests/testSuite';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import DataQualityProvider, {
    useDataQualityProvider
} from '../../../pages/DataQuality/DataQualityProvider';
import { getCurrentISODate } from '../../../utils/date-time/DateTimeUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';
import Loader from '../../common/Loader/Loader';
import TestCaseFormDrawer from '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer';
import BundleSuiteFormDrawer from '../../DataQuality/BundleSuiteForm/BundleSuiteFormDrawer';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { ExportData } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import { OBSERVABILITY_ROUTES } from '../observability.constants';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';

const DataQualityDashboard = withSuspenseFallback(
  lazy(() => import('./Dashboard/DataQualityDashboard'))
);

const TestCases = withSuspenseFallback(
  lazy(() => import('./TestCases/TestCases'))
);

const TestSuites = withSuspenseFallback(
  lazy(() => import('./TestSuites/TestSuites'))
);

const DATA_QUALITY_TABS = [
  {
    id: DataQualityPageTabs.DASHBOARD,
    labelKey: 'label.summary',
    component: DataQualityDashboard,
  },
  {
    id: DataQualityPageTabs.TEST_CASES,
    labelKey: 'label.test-case-plural',
    component: TestCases,
  },
  {
    id: DataQualityPageTabs.TEST_SUITES,
    labelKey: 'label.test-suite-plural',
    component: TestSuites,
  },
];

// All tabs consume the provider summary. Delay their mount until it resolves
// so child empty states do not flash before the shared counts are available.
const DataQualityTabContent = ({
  activeTabComponent: ActiveTabComponent,
}: {
  activeTabComponent?: ComponentType;
}) => {
  const { isTestCaseSummaryLoading } = useDataQualityProvider();

  if (isTestCaseSummaryLoading) {
    return (
      <div className="tw:flex tw:h-full tw:min-h-48 tw:items-center tw:justify-center">
        <Loader />
      </div>
    );
  }

  return ActiveTabComponent ? <ActiveTabComponent /> : null;
};

const DataQualityPage = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // App mode keeps visited routes mounted, so this page outlives its own URL.
  // Its filters come from the query string — which is global — so once another
  // route owns the URL, anything derived from it here is that route's state,
  // not ours.
  const ownsTheUrl = pathname.startsWith(
    OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE
  );
  const { tab } = useParams<{ tab?: DataQualityPageTabs }>();
  // Fall back to the Dashboard tab for a missing or unrecognized route param,
  // otherwise an unknown tab renders a blank content area.
  const activeTab =
    DATA_QUALITY_TABS.find((dqTab) => dqTab.id === tab)?.id ??
    DataQualityPageTabs.DASHBOARD;
  const navigate = useNavigate();
  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission, testCase: testCasePermission } =
    permissions;
  const { showModal } = useEntityExportModalProvider();

  const [isBundleSuiteModalOpen, setIsBundleSuiteModalOpen] = useState(false);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);

  const items = useMemo(
    () =>
      DATA_QUALITY_TABS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
    [t]
  );

  const ActiveTabComponent = useMemo(
    () => DATA_QUALITY_TABS.find((tab) => tab.id === activeTab)?.component,
    [activeTab]
  );

  const handleTabChange = useCallback(
    (tabKey: string) => {
      if (tabKey !== activeTab) {
        navigate(
          observabilityRouterClassBase.getDataQualityPagePath(
            tabKey as DataQualityPageTabs
          )
        );
      }
    },
    [navigate, activeTab]
  );

  const handleOpenTestCaseModal = useCallback(
    () => setIsTestCaseModalOpen(true),
    []
  );
  const handleCloseTestCaseModal = useCallback(
    () => setIsTestCaseModalOpen(false),
    []
  );
  const handleOpenBundleSuiteModal = useCallback(
    () => setIsBundleSuiteModalOpen(true),
    []
  );
  const handleCloseBundleSuiteModal = useCallback(
    () => setIsBundleSuiteModalOpen(false),
    []
  );

  const handleTestCaseSubmit = useCallback(
    (testCase: TestCase) => {
      if (testCase.fullyQualifiedName) {
        navigate(
          observabilityRouterClassBase.getTestCaseDetailPagePath(
            testCase.fullyQualifiedName
          )
        );
      }
    },
    [navigate]
  );

  const handleBundleSuiteSuccess = useCallback(
    (testSuite: TestSuite) => {
      if (testSuite.fullyQualifiedName) {
        navigate(
          observabilityRouterClassBase.getTestSuitePath(
            testSuite.fullyQualifiedName
          )
        );
      }
    },
    [navigate]
  );

  const handleExportDashboard = () =>
    showModal({
      name: `Dashboard-Chart_${getCurrentISODate()}`,
      title: t('label.data-quality-dashboard'),
      documentSelector: '.export-pdf-container',
      exportTypes: [ExportTypes.PDF],
    } as ExportData);

  const trailing = (
    <>
      {activeTab === DataQualityPageTabs.TEST_SUITES &&
        testSuitePermission?.Create && (
          <Button
            color="primary"
            data-testid="add-test-suite-btn"
            iconLeading={Plus}
            size="md"
            onPress={handleOpenBundleSuiteModal}>
            {t('label.add-a-entity', {
              entity: t('label.bundle-suite'),
            })}
          </Button>
        )}
      {activeTab === DataQualityPageTabs.TEST_CASES && (
        <Button
          color="primary"
          data-testid="add-test-case-btn"
          iconLeading={Plus}
          size="md"
          onPress={handleOpenTestCaseModal}>
          {t('label.add-a-entity', {
            entity: t('label.test-case'),
          })}
        </Button>
      )}
      {activeTab === DataQualityPageTabs.DASHBOARD && (
        <>
          <Button
            color="secondary"
            data-testid="export-pdf-button"
            iconLeading={Upload01}
            size="md"
            onPress={handleExportDashboard}>
            {t('label.export-pdf')}
          </Button>
          <Dropdown.Root>
            <Button
              color="primary"
              data-testid="data-quality-add-button-menu"
              iconTrailing={ChevronDown}
              size="md">
              {t('label.add')}
            </Button>
            <Dropdown.Popover className="tw:w-44">
              <Dropdown.Menu aria-label={t('label.add')}>
                <Dropdown.Item
                  id="add-test-case"
                  label={t('label.test-case')}
                  onAction={handleOpenTestCaseModal}
                />
                {testSuitePermission?.Create && (
                  <Dropdown.Item
                    id="add-bundle-suite"
                    label={t('label.bundle-suite')}
                    onAction={handleOpenBundleSuiteModal}
                  />
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </>
      )}
    </>
  );

  const createActions = useMemo(
    () => ({
      onAddTestCase: handleOpenTestCaseModal,
      onAddBundleSuite: handleOpenBundleSuiteModal,
      canCreateTestCase: Boolean(testCasePermission?.Create),
      canCreateBundleSuite: Boolean(testSuitePermission?.Create),
    }),
    [
      handleOpenTestCaseModal,
      handleOpenBundleSuiteModal,
      testCasePermission?.Create,
      testSuitePermission?.Create,
    ]
  );

  return (
    <DataQualityProvider createActions={createActions} isActive={ownsTheUrl}>
      <ObservabilityPageShell
        header={
          <HeaderShell
            actions={trailing}
            badge={
              <LearningIcon
                pageId={LEARNING_PAGE_IDS.DATA_QUALITY}
                title={t('label.data-quality')}
              />
            }
            breadcrumb={
              <HeaderBreadcrumb
                noMargin
                className="tw:text-xs"
                items={[
                  getObservabilityRootBreadcrumb(t),
                  {
                    label: t('label.data-quality'),
                    ariaLabel: t('label.data-quality'),
                  },
                ]}
                showHome={false}
              />
            }
            footer={
              <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => handleTabChange(String(key))}>
                <Tabs.List
                  className="tw:mt-2 tw:gap-6 tw:before:hidden"
                  items={items}
                  size="sm"
                  type="underline">
                  {(item) => (
                    <Tabs.Item
                      {...item}
                      className={({ isSelected }) =>
                        isSelected ? 'tw:font-semibold' : 'tw:font-medium'
                      }
                    />
                  )}
                </Tabs.List>
              </Tabs>
            }
            padding="comfortable"
            subtitle={t('message.page-sub-header-for-data-quality')}
            title={t('label.data-quality')}
            variant="gradient"
          />
        }
        pageTitle={t('label.data-quality')}>
        <DataQualityTabContent activeTabComponent={ActiveTabComponent} />
      </ObservabilityPageShell>

      <BundleSuiteFormDrawer
        open={isBundleSuiteModalOpen}
        variant="modal"
        onClose={handleCloseBundleSuiteModal}
        onSuccess={handleBundleSuiteSuccess}
      />
      <TestCaseFormDrawer
        open={isTestCaseModalOpen}
        variant="modal"
        onClose={handleCloseTestCaseModal}
        onFormSubmit={handleTestCaseSubmit}
      />
    </DataQualityProvider>
  );
};

export default DataQualityPage;
