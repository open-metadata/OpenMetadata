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
import {
  Box,
  Button,
  Tabs,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01, RefreshCcw01 } from '@untitledui/icons';
import classNames from 'classnames';
import { isUndefined, toString } from 'lodash';
import { ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TestCaseIcon } from '../../../assets/svg/ic-checklist.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useTestCaseDetailPage } from '../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCaseDetailPage';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityFQN } from '../../../utils/FeedUtilsPure';
import Fqn from '../../../utils/Fqn';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import {
  getEntityDetailsPath,
  getServiceDetailsPath,
} from '../../../utils/RouterUtils';
import { stringToHTML } from '../../../utils/StringUtils';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { BetaBadge } from '../../common/Badge/Badge.component';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { StatItem } from '../../DataAssets/DataAssetsHeader/StatItem.component';
import TestCaseFormDrawer from '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer';
import IncidentManagerPageHeader from '../../DataQuality/IncidentManager/IncidentManagerPageHeader/IncidentManagerPageHeader.component';
import { useTestCaseIncidentHeader } from '../../DataQuality/IncidentManager/IncidentManagerPageHeader/useTestCaseIncidentHeader';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import { OBSERVABILITY_ROUTES } from '../observability.constants';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';
import './test-case-detail.less';
import { TestCaseDetailProps } from './TestCaseDetail.types';

const breakableTooltipText = (text?: ReactNode) => (
  <span className="tw:block tw:max-w-full tw:break-words">{text}</span>
);

/**
 * App-mode test-case detail page. Follows the data-asset (table) details page
 * header design: breadcrumb, icon + title row with version/manage actions,
 * the inline labeled details row (reused OSS IncidentManagerPageHeader), and
 * a core-components underline tab strip with the OSS tab bodies unchanged.
 * All data + handlers come from the shared useTestCaseDetailPage OSS hook.
 */
const TestCaseDetail = ({ isVersionPage = false }: TestCaseDetailProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useCustomLocation();
  // Origin trail handed over by the listing the user came from (incident
  // listing, Data Quality test cases, a bundle suite, or a table's quality
  // tab). Producers set it as react-router navigation state on their links.
  const originBreadcrumb = (
    location.state as {
      breadcrumbData?: TitleBreadcrumbProps['titleLinks'];
    } | null
  )?.breadcrumbData;

  const {
    testCase,
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
    handleOwnerChange,
    handleDisplayNameChange,
    getEntityFeedCount,
    setTestCase,
  } = useTestCaseDetailPage({ isVersionPage });
  const incidentHeaderData = useTestCaseIncidentHeader({
    fetchTaskCount: getEntityFeedCount,
    isVersionPage,
  });

  const activeTabContent = useMemo(() => {
    const currentTab = tabs.find(({ key }) => key === activeTab) ?? tabs.at(0);

    if (!currentTab) {
      return null;
    }

    const { Tab } = currentTab;

    return <Tab editVariant="modal" showSidePanel={isTabExpanded} />;
  }, [tabs, activeTab, isTabExpanded]);

  const breadcrumbItems = useMemo(() => {
    // The origin trail wins so the crumb reflects where the user came from;
    // the compact asset trail (service > ... > table) is only the fallback
    // for deep links and refreshes. Both sit behind the module icon crumb;
    // HeaderBreadcrumb's maxItems collapses the middle crumbs into a "..."
    // menu.
    const tableFqn = getEntityFQN(testCase?.entityLink ?? '');
    const fqnParts = tableFqn ? Fqn.split(tableFqn) : [];
    const [service, database, schema, table] = fqnParts;

    const assetTrail =
      fqnParts.length === 4
        ? [
            {
              label: service,
              ariaLabel: service,
              href: getServiceDetailsPath(
                service,
                ServiceCategory.DATABASE_SERVICES
              ),
            },
            {
              label: database,
              ariaLabel: database,
              href: getEntityDetailsPath(
                EntityType.DATABASE,
                `${service}.${database}`
              ),
            },
            {
              label: schema,
              ariaLabel: schema,
              href: getEntityDetailsPath(
                EntityType.DATABASE_SCHEMA,
                `${service}.${database}.${schema}`
              ),
            },
            {
              label: table,
              ariaLabel: table,
              href: getEntityDetailsPath(EntityType.TABLE, tableFqn),
            },
          ]
        : [
            {
              label: t('label.data-quality'),
              ariaLabel: t('label.data-quality'),
              href: OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE,
            },
          ];

    const leadingTrail = originBreadcrumb?.length
      ? originBreadcrumb.map(({ name, url }) => ({
          label: name,
          ariaLabel: name,
          href: url ? String(url) : undefined,
        }))
      : assetTrail;

    const items = [getObservabilityRootBreadcrumb(t), ...leadingTrail];

    const buildCrumbs = () => {
      if (isDimensionPage) {
        return [
          ...items,
          {
            label: testCase?.name ?? '',
            ariaLabel: testCase?.name ?? '',
            href: observabilityRouterClassBase.getTestCaseDetailPagePath(
              testCase?.fullyQualifiedName ?? ''
            ),
          },
          {
            label: dimensionKey ?? '',
            ariaLabel: dimensionKey ?? '',
          },
        ];
      }

      return [
        ...items,
        {
          label: testCase?.name ?? '',
          ariaLabel: testCase?.name ?? '',
        },
      ];
    };

    return buildCrumbs();
  }, [t, testCase, isDimensionPage, dimensionKey, originBreadcrumb]);

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
          entity: t('label.test-case'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isUndefined(testCase)) {
    return <ErrorPlaceHolder />;
  }

  const getPageTitle = () =>
    t(
      isVersionPage
        ? 'label.entity-version-detail-plural'
        : 'label.entity-detail-plural',
      {
        entity: getEntityName(testCase) || t('label.test-case'),
      }
    );

  const renderHeaderTitle = () => (
    <Box className="tw:min-w-0" direction="col">
      {displayName && (
        <Typography
          as="h2"
          className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
          data-testid="entity-header-display-name"
          ellipsis={{
            tooltip: breakableTooltipText(stringToHTML(displayName)),
          }}
          size="text-lg"
          weight="bold">
          {stringToHTML(displayName)}
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
          tooltip: breakableTooltipText(testCase?.name),
        }}
        size={displayName ? 'text-sm' : 'text-lg'}
        weight={displayName ? 'medium' : 'bold'}>
        {testCase?.name}
      </Typography>
    </Box>
  );

  const renderExpandButton = () => {
    if (!isExpandViewSupported) {
      return null;
    }

    return (
      <AlignRightIconButton
        className={isTabExpanded ? 'rotate-180' : ''}
        title={isTabExpanded ? t('label.collapse') : t('label.expand')}
        onClick={toggleTabExpanded}
      />
    );
  };

  return (
    <>
      <ObservabilityPageShell
        className={classNames({ 'version-data': isVersionPage })}
        data-testid="test-case-detail-page"
        header={
          <Box
            className="tw:relative tw:rounded-xl tw:border tw:border-border-secondary tw:bg-primary tw:px-5 tw:py-4 data-assets-header-container"
            data-testid="test-case-header-container"
            direction="col"
            gap={4}>
            <Box align="center" gap={4} justify="between" wrap="wrap">
              <div className="tw:min-w-0 tw:flex-1">
                <HeaderBreadcrumb
                  className="tw:mb-0"
                  items={breadcrumbItems}
                  maxItems={3}
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
            <Box direction="col" gap={2}>
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
                    {renderHeaderTitle()}
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
                        onClick={handleCopyEntityUrl}
                      />
                    </Tooltip>
                  </Box>
                </Box>
                <Box align="center" className="tw:shrink-0" gap={2}>
                  {!isVersionPage && (
                    <ManageButton
                      isRecursiveDelete
                      afterDeleteAction={() =>
                        navigate(
                          observabilityRouterClassBase.getDataQualityPagePath()
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
                incidentHeaderData={incidentHeaderData}
                isVersionPage={isVersionPage}
                onOwnerUpdate={handleOwnerChange}
              />
            </Box>
          </Box>
        }
        pageTitle={getPageTitle()}>
        <div className="test-case-detail-tabs">
          <Box
            align="end"
            // Reserve the expand button's height (40px + border) so the strip
            // doesn't collapse and shift the tab body when the button unmounts
            // on non-result tabs.
            className="tw:min-h-10.25 tw:border-b tw:border-secondary"
            gap={2}
            justify="between">
            <Tabs
              className="tw:w-fit"
              data-testid="tabs"
              selectedKey={activeTab}
              onSelectionChange={(key) => handleTabChange(String(key))}>
              <Tabs.List size="sm" type="underline">
                {tabs.map(({ labelProps, key, isBeta }) => (
                  <Tabs.Item
                    badge={toString(labelProps.count) || undefined}
                    data-testid={labelProps.id}
                    id={key}
                    key={key}
                    label={
                      isBeta ? (
                        <Box inline align="center" gap={1}>
                          {labelProps.name}
                          <BetaBadge />
                        </Box>
                      ) : (
                        labelProps.name
                      )
                    }
                  />
                ))}
              </Tabs.List>
            </Tabs>
            {renderExpandButton()}
          </Box>
          <div className="test-case-detail-tab-panel">{activeTabContent}</div>
        </div>
      </ObservabilityPageShell>
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
        <TestCaseFormDrawer
          open={isDimensionEdit}
          testCase={testCase}
          variant="modal"
          onClose={handleCancelDimension}
          onUpdate={setTestCase}
        />
      )}
    </>
  );
};

export default withActivityFeed(TestCaseDetail);
