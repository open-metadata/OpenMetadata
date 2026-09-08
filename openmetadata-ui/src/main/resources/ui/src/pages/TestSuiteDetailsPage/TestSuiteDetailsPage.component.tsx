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
  Input,
  Modal,
  ModalOverlay,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01 } from '@untitledui/icons';
import { Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { ComponentProps, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TestSuiteIcon } from '../../assets/svg/icon-test-suite.svg';
import { useListSearchInput } from '../../components/common/atoms/navigation/useListSearchInput';
import { DomainLabel } from '../../components/common/DomainLabel/DomainLabel.component';
import Description from '../../components/common/EntityDescription/Description';
import ManageButton from '../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import Loader from '../../components/common/Loader/Loader';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import DataQualityTab from '../../components/Database/Profiler/DataQualityTab/DataQualityTab';
import { AddTestCaseList } from '../../components/DataQuality/AddTestCaseList/AddTestCaseList.component';
import TestSuitePipelineTab from '../../components/DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { LearningIcon } from '../../components/Learning/LearningIcon/LearningIcon.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import { useClipboard } from '../../hooks/useClipBoard';
import { DataQualityPageTabs } from '../../pages/DataQuality/DataQualityPage.interface';
import { HeaderDotSeparator } from '../../utils/DataAssetsHeader.utils';
import { getEntityName } from '../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import { useTestSuiteDetailsPage } from './hooks/useTestSuiteDetailsPage';
import './test-suite-details-page.less';

const breakableTooltipText = (text?: string) => (
  <span className="tw:block tw:max-w-full tw:break-words">{text}</span>
);

interface TestSuiteHeaderTitleProps {
  displayName?: string;
  name?: string;
  hasCopied: boolean;
  onCopyEntityUrl: () => void;
}

const TestSuiteHeaderTitle = ({
  displayName,
  name,
  hasCopied,
  onCopyEntityUrl,
}: TestSuiteHeaderTitleProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:min-w-0"
      data-testid="entity-header-title"
      gap={3}>
      <Box className="tw:min-w-0" direction="col">
        {displayName && (
          <Typography
            as="h2"
            className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
            data-testid="entity-header-display-name"
            ellipsis={{
              tooltip: breakableTooltipText(displayName),
            }}
            size="text-lg"
            weight="bold">
            {displayName}
          </Typography>
        )}
        <Typography
          as={displayName ? 'span' : 'h2'}
          className={classNames(
            'tw:m-0 tw:block tw:min-w-0 tw:truncate tw:text-left',
            {
              'tw:text-primary': !displayName,
              'tw:text-tertiary': displayName,
            }
          )}
          data-testid="entity-header-name"
          ellipsis={{
            tooltip: breakableTooltipText(name),
          }}
          size={displayName ? 'text-sm' : 'text-lg'}
          weight={displayName ? 'medium' : 'bold'}>
          {name}
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
        <Button
          aria-label={t('label.copy-item', {
            item: t('label.url-uppercase'),
          })}
          color="tertiary"
          data-testid="entity-header-copy-button"
          iconLeading={Copy01}
          size="xs"
          type="button"
          onClick={onCopyEntityUrl}
        />
      </Tooltip>
      <LearningIcon pageId={LEARNING_PAGE_IDS.TEST_SUITE} />
    </Box>
  );
};

interface AddTestCaseDialogTriggerProps {
  canAddTestCase: boolean;
  isTestCaseModalOpen: boolean;
  setIsTestCaseModalOpen: (open: boolean) => void;
  testCasePluralLabel: string;
  existingTest: EntityReference[];
  onSubmit: ComponentProps<typeof AddTestCaseList>['onSubmit'];
}

const getAddTestCasePopupContainer = (trigger: HTMLElement) =>
  (trigger.closest('[role="dialog"]') as HTMLElement) ?? document.body;

const AddTestCaseDialogTrigger = ({
  canAddTestCase,
  isTestCaseModalOpen,
  setIsTestCaseModalOpen,
  testCasePluralLabel,
  existingTest,
  onSubmit,
}: AddTestCaseDialogTriggerProps) => {
  const { t } = useTranslation();

  if (!canAddTestCase) {
    return null;
  }

  return (
    <DialogTrigger
      isOpen={isTestCaseModalOpen}
      onOpenChange={setIsTestCaseModalOpen}>
      <Button color="primary" data-testid="add-test-case-btn" size="md">
        {t('label.add-entity', {
          entity: testCasePluralLabel,
        })}
      </Button>
      <ModalOverlay>
        <Modal>
          <Dialog
            showCloseButton
            title={t('label.add-entity', {
              entity: testCasePluralLabel,
            })}
            onClose={() => setIsTestCaseModalOpen(false)}>
            <Dialog.Content>
              <AddTestCaseList
                existingTest={existingTest}
                getPopupContainer={getAddTestCasePopupContainer}
                onCancel={() => setIsTestCaseModalOpen(false)}
                onSubmit={onSubmit}
              />
            </Dialog.Content>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
};

const TestSuiteDetailsPage = () => {
  const { t } = useTranslation();
  const testCasePluralLabel = t('label.test-case-plural');
  const navigate = useNavigate();
  const {
    testSuite,
    testSuiteDescription,
    descriptionChangeSummaryEntry,
    testOwners,
    isLoading,
    isTestCaseLoading,
    testCaseResult,
    testCaseSearchQuery,
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
    handleTestCaseSearch,
    handleSortTestCase,
    handleAddTestCaseSubmit,
    onUpdateOwner,
    handleDomainUpdate,
    onDescriptionUpdate,
    handleDisplayNameChange,
    handleTestSuiteUpdate,
  } = useTestSuiteDetailsPage();

  const { searchInputProps } = useListSearchInput({
    searchQuery: testCaseSearchQuery,
    onSearchChange: handleTestCaseSearch,
  });
  // UI core and Untitled icons currently resolve React types from separate
  // package trees even though their runtime component contract is compatible.
  const searchInputIcon = searchInputProps.icon as ComponentProps<
    typeof Input
  >['icon'];
  const testCaseSearchLabel = t('label.search-entity', {
    entity: testCasePluralLabel,
  });

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

  const tabItems: TabsProps['items'] = useMemo(() => {
    const renderDescription = () => (
      <div className="tw:w-full">
        <Description
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

    const removeFromTestSuite = testSuite
      ? {
          testSuite,
          isAllowed:
            testSuitePermissions.EditAll || testSuitePermissions.EditTests,
        }
      : undefined;

    return [
      {
        key: EntityTabs.TEST_CASES,
        label: (
          <TabsLabel
            count={pagingData.paging.total}
            id={EntityTabs.TEST_CASES}
            name={testCasePluralLabel}
          />
        ),
        children: (
          <Box className="tw:p-4" direction="col" gap={4}>
            {renderDescription()}
            <div className="tw:w-full">
              <DataQualityTab
                afterDeleteAction={fetchTestCases}
                breadcrumbData={incidentUrlState}
                fetchTestCases={handleSortTestCase}
                hasActiveFilters={Boolean(testCaseSearchQuery.trim())}
                isLoading={isLoading || isTestCaseLoading}
                pagingData={pagingData}
                removeFromTestSuite={removeFromTestSuite}
                showPagination={showPagination}
                tableHeader={
                  <Box align="center" className="tw:w-full" justify="end">
                    <Input
                      {...searchInputProps}
                      aria-label={testCaseSearchLabel}
                      className="tw:w-full tw:max-w-72"
                      icon={searchInputIcon}
                      inputDataTestId="test-suite-test-case-search"
                      placeholder={testCaseSearchLabel}
                    />
                  </Box>
                }
                testCases={testCaseResult}
                onTestCaseResultUpdate={handleTestSuiteUpdate}
                onTestUpdate={handleTestSuiteUpdate}
              />
            </div>
          </Box>
        ),
      },
      {
        key: EntityTabs.PIPELINE,
        label: (
          <TabsLabel
            count={ingestionPipelineCount}
            id={EntityTabs.PIPELINE}
            name={t('label.pipeline-plural')}
          />
        ),
        children: (
          <div className="tw:w-full tw:p-4">
            <TestSuitePipelineTab isLogicalTestSuite testSuite={testSuite} />
          </div>
        ),
      },
    ];
  }, [
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
    testCaseSearchQuery,
    testCaseSearchLabel,
    testCasePluralLabel,
    searchInputIcon,
    searchInputProps,
    handleTestSuiteUpdate,
    ingestionPipelineCount,
    t,
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
              <TestSuiteHeaderTitle
                displayName={testSuite?.displayName}
                hasCopied={hasCopied}
                name={testSuite?.name}
                onCopyEntityUrl={handleCopyEntityUrl}
              />
            </Box>
            <Box align="center" className="tw:shrink-0" gap={2}>
              <AddTestCaseDialogTrigger
                canAddTestCase={Boolean(
                  testSuitePermissions.EditAll || testSuitePermissions.EditTests
                )}
                existingTest={testSuite?.tests ?? []}
                isTestCaseModalOpen={isTestCaseModalOpen}
                setIsTestCaseModalOpen={setIsTestCaseModalOpen}
                testCasePluralLabel={testCasePluralLabel}
                onSubmit={handleAddTestCaseSubmit}
              />
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
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="tabs-new"
            data-testid="tabs"
            items={tabItems}
            onChange={(key) => setActiveTab(key)}
          />
        </div>
      </Box>
    </PageLayoutV1>
  );
};

export default TestSuiteDetailsPage;
