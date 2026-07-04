/*
 *  Copyright 2023 Collate.
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
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01, RefreshCcw01 } from '@untitledui/icons';
import { Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { isUndefined, toString } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as TestCaseIcon } from '../../../assets/svg/ic-checklist.svg';
import { withActivityFeed } from '../../../components/AppRouter/withActivityFeed';
import { BetaBadge } from '../../../components/common/Badge/Badge.component';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { AlignRightIconButton } from '../../../components/common/IconButtons/EditIconButton';
import Loader from '../../../components/common/Loader/Loader';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { StatItem } from '../../../components/DataAssets/DataAssetsHeader/StatItem.component';
import EditTestCaseModal from '../../../components/DataQuality/AddDataQualityTest/EditTestCaseModal';
import IncidentManagerPageHeader from '../../../components/DataQuality/IncidentManager/IncidentManagerPageHeader/IncidentManagerPageHeader.component';
import EntityVersionTimeLine from '../../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getEntityName } from '../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { TestCasePageTabs } from '../IncidentManager.interface';
import './incident-manager-details.less';
import { useTestCaseDetailPage } from './useTestCaseDetailPage';

// Header names are dot/underscore-joined FQN segments with no spaces; let
// them wrap inside the tooltip bubble instead of overflowing it.
const breakableTooltipText = (text?: string) => (
  <span className="tw:block tw:max-w-full tw:break-words">{text}</span>
);

const IncidentManagerDetailPage = ({
  isVersionPage = false,
}: {
  isVersionPage?: boolean;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    testCase,
    testCaseFQN,
    isLoading,
    hasViewPermission,
    hasDeletePermission,
    editDisplayNamePermission,
    displayName,
    tabs,
    activeTab,
    handleTabChange,
    isExpandViewSupported,
    isTabExpanded,
    toggleTabExpanded,
    version,
    versionList,
    versionHandler,
    onVersionClick,
    isDimensionPage,
    dimensionKey,
    isDimensionEdit,
    handleCancelDimension,
    extraDropdownContent,
    handleDisplayNameChange,
    handleOwnerChange,
    getEntityFeedCount,
    setTestCase,
  } = useTestCaseDetailPage({ isVersionPage });

  const tabItems: TabsProps['items'] = useMemo(
    () =>
      tabs.map(({ LabelComponent, labelProps, key, Tab, isBeta }) => ({
        key,
        label: (
          <div className="tw:flex tw:items-center tw:gap-1">
            <LabelComponent {...labelProps} />
            {isBeta && <BetaBadge />}
          </div>
        ),
        children: <Tab showSidePanel={isTabExpanded} />,
      })),
    [tabs, isTabExpanded]
  );

  const breadcrumb = useMemo(() => {
    const data: TitleBreadcrumbProps['titleLinks'] = location.state
      ?.breadcrumbData
      ? [...location.state.breadcrumbData]
      : [
          {
            name: t('label.incident-manager'),
            url: observabilityRouterClassBase.getIncidentManagerPath(),
          },
        ];

    if (isDimensionPage) {
      return [
        ...data,
        {
          name: testCase?.name ?? '',
          url: observabilityRouterClassBase.getTestCaseDetailPagePath(
            testCaseFQN,
            activeTab as TestCasePageTabs
          ),
          activeTitle: false,
        },
        {
          name: dimensionKey || '',
          url: '',
          activeTitle: true,
        },
      ];
    }

    return [
      ...data,
      {
        name: testCase?.name ?? '',
        url: '',
        activeTitle: true,
      },
    ];
  }, [testCase, location.state, isDimensionPage, dimensionKey]);

  const breadcrumbItems = useMemo(
    () =>
      breadcrumb.map((link) => ({
        label: link.name,
        href: link.url ? String(link.url) : undefined,
      })),
    [breadcrumb]
  );

  const { onCopyToClipBoard, hasCopied } = useClipboard('', 2000);

  const handleCopyEntityUrl = useCallback(async () => {
    await onCopyToClipBoard(globalThis.location.href);
  }, [onCopyToClipBoard]);

  if (isLoading) {
    return <Loader />;
  }

  if (!hasViewPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.incident-manager'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isUndefined(testCase)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      pageTitle={t(
        isVersionPage
          ? 'label.entity-version-detail-plural'
          : 'label.entity-detail-plural',
        {
          entity: getEntityName(testCase) || t('label.test-case'),
        }
      )}>
      <Box
        className={classNames({
          'version-data': isVersionPage,
        })}
        data-testid="incident-manager-details-page-container"
        direction="col"
        gap={5}>
        <Box
          className="tw:relative tw:rounded-xl tw:border tw:border-border-secondary tw:bg-primary tw:p-5 data-assets-header-container"
          data-testid="test-case-header-container"
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
            <Box align="center" gap={4}>
              {!isDimensionPage && (
                <StatItem
                  count={testCase?.version}
                  icon={RefreshCcw01}
                  testId="version-button"
                  tooltip={t('label.version-plural-history')}
                  onClick={onVersionClick}
                />
              )}
            </Box>
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
                <TestCaseIcon className="tw:size-5" />
              </Box>
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
                      ellipsis={{ tooltip: breakableTooltipText(displayName) }}
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
                    ellipsis={{ tooltip: breakableTooltipText(testCase?.name) }}
                    size={displayName ? 'text-sm' : 'text-lg'}
                    weight={displayName ? 'medium' : 'bold'}>
                    {testCase?.name}
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
              </Box>
            </Box>
            <Box align="center" className="tw:shrink-0" gap={2}>
              {!isVersionPage && (
                <ManageButton
                  isRecursiveDelete
                  afterDeleteAction={() =>
                    navigate(
                      observabilityRouterClassBase.getIncidentManagerPath()
                    )
                  }
                  allowSoftDelete={false}
                  canDelete={hasDeletePermission}
                  displayName={testCase.displayName}
                  editDisplayNamePermission={editDisplayNamePermission}
                  entityFQN={testCase.fullyQualifiedName}
                  entityId={testCase.id}
                  entityName={testCase.name}
                  entityType={EntityType.TEST_CASE}
                  extraDropdownContent={extraDropdownContent}
                  onEditDisplayName={handleDisplayNameChange}
                />
              )}
            </Box>
          </Box>
          <IncidentManagerPageHeader
            fetchTaskCount={getEntityFeedCount}
            isVersionPage={isVersionPage}
            testCaseData={testCase}
            onOwnerUpdate={handleOwnerChange}
          />
        </Box>
        <div className="incident-manager-details-tabs">
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="tabs-new"
            data-testid="tabs"
            items={tabItems}
            tabBarExtraContent={
              isExpandViewSupported && (
                <AlignRightIconButton
                  className={isTabExpanded ? 'rotate-180' : ''}
                  title={
                    isTabExpanded ? t('label.collapse') : t('label.expand')
                  }
                  onClick={toggleTabExpanded}
                />
              )
            }
            onChange={handleTabChange}
          />
        </div>
      </Box>
      {isVersionPage && (
        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={EntityType.TEST_CASE}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={onVersionClick}
        />
      )}
      {testCase && isDimensionEdit && (
        <EditTestCaseModal
          testCase={testCase}
          visible={isDimensionEdit}
          onCancel={handleCancelDimension}
          onUpdate={setTestCase}
        />
      )}
    </PageLayoutV1>
  );
};

export default withActivityFeed(IncidentManagerDetailPage);
