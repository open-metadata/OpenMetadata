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

import {
  Box,
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Tabs,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01 } from '@untitledui/icons';
import classNames from 'classnames';
import { toString } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TestSuiteIcon } from '../../assets/svg/icon-test-suite.svg';
import { DomainLabel } from '../../components/common/DomainLabel/DomainLabel.component';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ManageButton from '../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import Loader from '../../components/common/Loader/Loader';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import DataQualityTab from '../../components/Database/Profiler/DataQualityTab/DataQualityTab';
import { AddTestCaseList } from '../../components/DataQuality/AddTestCaseList/AddTestCaseList.component';
import TestSuitePipelineTab from '../../components/DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { LearningIcon } from '../../components/Learning/LearningIcon/LearningIcon.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { useClipboard } from '../../hooks/useClipBoard';
import { DataQualityPageTabs } from '../../pages/DataQuality/DataQualityPage.interface';
import { HeaderDotSeparator } from '../../utils/DataAssetsHeader.utils';
import { getEntityName } from '../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import './test-suite-details-page.less';
import { useTestSuiteDetailsPage } from './useTestSuiteDetailsPage';

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    testSuite,
    testSuiteDescription,
    descriptionChangeSummaryEntry,
    testOwners,
    isLoading,
    isTestCaseLoading,
    testCaseResult,
    testSuitePermissions,
    permissions,
    extraDropdownContent,
    activeTab,
    setActiveTab,
    isTestCaseModalOpen,
    setIsTestCaseModalOpen,
    slashedBreadCrumb,
    incidentUrlState,
    pagingData,
    showPagination,
    ingestionPipelineCount,
    canAddMultipleDomains,
    canAddMultipleUserOwners,
    canAddMultipleTeamOwner,
    fetchTestCases,
    handleSortTestCase,
    handleAddTestCaseSubmit,
    onUpdateOwner,
    handleDomainUpdate,
    onDescriptionUpdate,
    handleDisplayNameChange,
    handleTestSuiteUpdate,
  } = useTestSuiteDetailsPage();

  const afterDeleteAction = () => {
    navigate(
      observabilityRouterClassBase.getDataQualityPagePath(
        DataQualityPageTabs.TEST_SUITES
      )
    );
  };

  const breadcrumbItems = useMemo(
    () =>
      slashedBreadCrumb.map((link) => ({
        label: link.name,
        href: link.url ? String(link.url) : undefined,
      })),
    [slashedBreadCrumb]
  );

  const { onCopyToClipBoard, hasCopied } = useClipboard('', 2000);

  const handleCopyEntityUrl = useCallback(async () => {
    await onCopyToClipBoard(globalThis.location.href);
  }, [onCopyToClipBoard]);

  const activeTabContent = useMemo(() => {
    const renderDescription = () => (
      <div className="tw:w-full">
        <DescriptionV1
          wrapInCard
          changeSummaryEntry={descriptionChangeSummaryEntry}
          description={testSuiteDescription}
          entityName={getEntityName(testSuite)}
          entityType={EntityType.TEST_SUITE}
          hasEditAccess={permissions.hasEditDescriptionPermission}
          showCommentsIcon={false}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </div>
    );

    if (activeTab === EntityTabs.PIPELINE) {
      return (
        <div className="tw:w-full">
          <TestSuitePipelineTab isLogicalTestSuite testSuite={testSuite} />
        </div>
      );
    }

    const removeFromTestSuite = testSuite
      ? {
          testSuite,
          isAllowed:
            testSuitePermissions.EditAll || testSuitePermissions.EditTests,
        }
      : undefined;

    return (
      <Box direction="col" gap={4}>
        {renderDescription()}
        <div className="tw:w-full">
          <DataQualityTab
            afterDeleteAction={fetchTestCases}
            breadcrumbData={incidentUrlState}
            fetchTestCases={handleSortTestCase}
            isLoading={isLoading || isTestCaseLoading}
            pagingData={pagingData}
            removeFromTestSuite={removeFromTestSuite}
            showPagination={showPagination}
            testCases={testCaseResult}
            onTestCaseResultUpdate={handleTestSuiteUpdate}
            onTestUpdate={handleTestSuiteUpdate}
          />
        </div>
      </Box>
    );
  }, [
    activeTab,
    testSuite,
    testSuiteDescription,
    descriptionChangeSummaryEntry,
    permissions.hasEditDescriptionPermission,
    onDescriptionUpdate,
    testSuitePermissions,
    fetchTestCases,
    incidentUrlState,
    handleSortTestCase,
    isLoading,
    isTestCaseLoading,
    pagingData,
    showPagination,
    testCaseResult,
    handleTestSuiteUpdate,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  if (!testSuitePermissions.ViewAll && !testSuitePermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-suite'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(testSuite),
      })}>
      <Box
        data-testid="test-suite-details-page-container"
        direction="col"
        gap={5}>
        <Box
          className="tw:relative tw:rounded-xl tw:border tw:border-border-secondary tw:bg-primary tw:p-5 data-assets-header-container"
          data-testid="test-suite-header-container"
          direction="col"
          gap={5}>
          <Box align="center" gap={4} justify="between" wrap="wrap">
            <div className="tw:min-w-0 tw:flex-1">
              <HeaderBreadcrumb
                className="tw:mb-0"
                items={breadcrumbItems}
                showHome={false}
                size="sm"
              />
            </div>
          </Box>
          <Box
            align="center"
            data-testid="entity-page-header"
            gap={4}
            wrap="wrap">
            <Box align="center" className="tw:min-w-0 tw:flex-1" gap={3}>
              <Box
                align="center"
                className={classNames(
                  'tw:relative tw:size-9 tw:shrink-0',
                  'tw:overflow-hidden tw:rounded-full',
                  'tw:bg-primary tw:border tw:border-border-secondary tw:shadow-xs-skeumorphic'
                )}
                justify="center">
                <TestSuiteIcon className="tw:size-5" />
              </Box>
              <Box
                align="center"
                className="tw:min-w-0"
                data-testid="entity-header-title"
                gap={3}>
                <Box className="tw:min-w-0" direction="col">
                  {testSuite?.displayName && (
                    <Typography
                      as="h2"
                      className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
                      data-testid="entity-header-display-name"
                      ellipsis={{ tooltip: testSuite.displayName }}
                      size="text-lg"
                      weight="bold">
                      {testSuite.displayName}
                    </Typography>
                  )}
                  <Typography
                    as={testSuite?.displayName ? 'span' : 'h2'}
                    className={classNames(
                      'tw:m-0 tw:block tw:min-w-0 tw:truncate tw:text-left',
                      {
                        'tw:text-primary': !testSuite?.displayName,
                        'tw:text-tertiary': testSuite?.displayName,
                      }
                    )}
                    data-testid="entity-header-name"
                    ellipsis={{ tooltip: testSuite?.name }}
                    size={testSuite?.displayName ? 'text-sm' : 'text-lg'}
                    weight={testSuite?.displayName ? 'medium' : 'bold'}>
                    {testSuite?.name}
                  </Typography>
                </Box>
                <Tooltip
                  placement="top"
                  title={
                    hasCopied
                      ? t('message.link-copy-to-clipboard')
                      : t('label.copy-item', {
                          item: t('label.url-uppercase'),
                        })
                  }>
                  <TooltipTrigger className="tw:flex tw:items-center">
                    <Button
                      aria-label={t('label.copy-item', {
                        item: t('label.url-uppercase'),
                      })}
                      color="tertiary"
                      data-testid="entity-header-copy-button"
                      iconLeading={Copy01}
                      size="xs"
                      type="button"
                      onClick={handleCopyEntityUrl}
                    />
                  </TooltipTrigger>
                </Tooltip>
                <LearningIcon pageId={LEARNING_PAGE_IDS.TEST_SUITE} />
              </Box>
            </Box>
            <Box align="center" className="tw:shrink-0" gap={2}>
              {(testSuitePermissions.EditAll ||
                testSuitePermissions.EditTests) && (
                <DialogTrigger
                  isOpen={isTestCaseModalOpen}
                  onOpenChange={setIsTestCaseModalOpen}>
                  <Button
                    color="primary"
                    data-testid="add-test-case-btn"
                    size="md">
                    {t('label.add-entity', {
                      entity: t('label.test-case-plural'),
                    })}
                  </Button>
                  <ModalOverlay>
                    <Modal>
                      <Dialog
                        showCloseButton
                        title={t('label.add-entity', {
                          entity: t('label.test-case-plural'),
                        })}
                        onClose={() => setIsTestCaseModalOpen(false)}>
                        <Dialog.Content>
                          <AddTestCaseList
                            existingTest={testSuite?.tests ?? []}
                            getPopupContainer={(trigger) =>
                              (trigger.closest(
                                '[role="dialog"]'
                              ) as HTMLElement) ?? document.body
                            }
                            onCancel={() => setIsTestCaseModalOpen(false)}
                            onSubmit={handleAddTestCaseSubmit}
                          />
                        </Dialog.Content>
                      </Dialog>
                    </Modal>
                  </ModalOverlay>
                </DialogTrigger>
              )}
              <ManageButton
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                allowSoftDelete={false}
                canDelete={permissions.hasDeletePermission}
                deleted={testSuite?.deleted}
                displayName={getEntityName(testSuite)}
                editDisplayNamePermission={
                  testSuitePermissions.EditAll ||
                  testSuitePermissions.EditDisplayName
                }
                entityId={testSuite?.id}
                entityName={testSuite?.fullyQualifiedName as string}
                entityType={EntityType.TEST_SUITE}
                extraDropdownContent={extraDropdownContent}
                onEditDisplayName={handleDisplayNameChange}
              />
            </Box>
          </Box>
          <div className="test-suite-details-header w-full">
            <DomainLabel
              headerLayout
              showDashPlaceholder
              domains={testSuite?.domains}
              entityFqn={testSuite?.fullyQualifiedName ?? ''}
              entityId={testSuite?.id ?? ''}
              entityType={EntityType.TEST_SUITE}
              hasPermission={Boolean(testSuitePermissions.EditAll)}
              multiple={canAddMultipleDomains}
              textClassName="render-domain-lebel-style"
              onUpdate={handleDomainUpdate}
            />
            <HeaderDotSeparator />
            <OwnerLabel
              showDashPlaceholder
              avatarSize={24}
              className="header-owner-heading"
              hasPermission={Boolean(permissions.hasEditOwnerPermission)}
              isCompactView={false}
              maxVisibleOwners={3}
              multiple={{
                user: canAddMultipleUserOwners,
                team: canAddMultipleTeamOwner,
              }}
              owners={testOwners}
              onUpdate={onUpdateOwner}
            />
          </div>
        </Box>
        <div className="test-suite-details-tabs" data-testid="tabs-root">
          <div className="tw:flex tw:items-end tw:border-b tw:border-secondary">
            <Tabs
              className="tw:w-fit"
              data-testid="tabs"
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(String(key))}>
              <Tabs.List size="sm" type="underline">
                <Tabs.Item
                  badge={toString(pagingData.paging.total) || undefined}
                  data-testid={EntityTabs.TEST_CASES}
                  id={EntityTabs.TEST_CASES}
                  label={t('label.test-case-plural')}
                />
                <Tabs.Item
                  badge={toString(ingestionPipelineCount) || undefined}
                  data-testid={EntityTabs.PIPELINE}
                  id={EntityTabs.PIPELINE}
                  label={t('label.pipeline-plural')}
                />
              </Tabs.List>
            </Tabs>
          </div>
          <div className="test-suite-details-tab-panel">{activeTabContent}</div>
        </div>
      </Box>
    </PageLayoutV1>
  );
};

export default TestSuiteDetailsPage;
