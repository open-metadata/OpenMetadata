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
  ClockCircleOutlined,
  LeftOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import {
  Button,
  Col,
  Dropdown,
  Row,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../../assets/svg/external-links.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconRestore } from '../../../../assets/svg/ic-restore.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { ICON_DIMENSION } from '../../../../constants/constants';
import { GlobalSettingOptions } from '../../../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { TabSpecificField } from '../../../../enums/entity.enum';
import {
  App,
  ScheduleTimeline,
  ScheduleType,
} from '../../../../generated/entity/applications/app';
import { EntityReference } from '../../../../generated/entity/type';
import { Include } from '../../../../generated/type/include';
import { useAuth } from '../../../../hooks/authHooks';
import { useFqn } from '../../../../hooks/useFqn';
import {
  configureApp,
  deployApp,
  getApplicationByName,
  patchApplication,
  restoreApp,
  triggerOnDemandApp,
  uninstallApp,
} from '../../../../rest/applicationAPI';
import {
  isCacheWarmupApplication,
  isMcpApplication,
} from '../../../../utils/ApplicationUtils';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import { getSettingPath } from '../../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import TabsLabel from '../../../common/TabsLabel/TabsLabel.component';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { useApplicationsProvider } from '../ApplicationsProvider/ApplicationsProvider';
import AppLiveIndexing from '../AppLiveIndexing/AppLiveIndexing.component';
import AppLogo from '../AppLogo/AppLogo.component';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import AppSchedule from '../AppSchedule/AppSchedule.component';
import { ApplicationTabs } from '../MarketPlaceAppDetails/MarketPlaceAppDetails.interface';
import McpApplicationConfiguration from '../McpApplicationConfiguration/McpApplicationConfiguration';
import './app-details.less';
import { AppAction } from './AppDetails.interface';
import applicationsClassBase from './ApplicationsClassBase';

type TFunc = ReturnType<typeof useTranslation>['t'];

const getIsRuntimeDisabled = (appData: App | undefined): boolean =>
  Boolean(appData?.enabled === false && !appData.deleted);

const getRuntimeDisabledReason = (
  appData: App | undefined,
  isRuntimeDisabled: boolean,
  t: TFunc
): string | undefined =>
  isRuntimeDisabled && isCacheWarmupApplication(appData?.name)
    ? t('message.cache-service-not-configured-message')
    : undefined;

const getIsAppUnavailable = (
  appData: App | undefined,
  isRuntimeDisabled: boolean
): boolean => Boolean(appData?.deleted) || isRuntimeDisabled;

interface ManageButtonHandlers {
  setShowActions: (value: boolean) => void;
  setAction: (value: AppAction) => void;
  setShowDeleteModel: (value: boolean) => void;
}

const getManageButtonContent = (
  appData: App | undefined,
  t: TFunc,
  { setShowActions, setAction, setShowDeleteModel }: ManageButtonHandlers
): ItemType[] => [
  ...(appData?.deleted
    ? ([
        {
          label: (
            <ManageButtonItemLabel
              description={t('message.restore-action-description', {
                entityType: getEntityName(appData),
              })}
              icon={IconRestore}
              id="restore-button"
              name={t('label.restore')}
            />
          ),
          onClick: (e: MenuInfo) => {
            e.domEvent.stopPropagation();
            setShowActions(false);
            setAction(AppAction.ENABLE);
            setShowDeleteModel(true);
          },
          key: 'restore-button',
        },
      ] as ItemType[])
    : [
        {
          label: (
            <ManageButtonItemLabel
              description={t('message.disable-app', {
                app: getEntityName(appData),
              })}
              icon={StopOutlined as SvgComponent}
              id="disable-button"
              name={t('label.disable')}
            />
          ),
          key: 'disable-button',
          onClick: () => {
            setShowDeleteModel(true);
            setShowActions(false);
            setAction(AppAction.DISABLE);
          },
        },
      ]),
  ...(appData?.system
    ? []
    : [
        {
          label: (
            <ManageButtonItemLabel
              description={t('message.uninstall-app', {
                app: getEntityName(appData),
              })}
              icon={DeleteIcon}
              id="uninstall-button"
              name={t('label.uninstall')}
            />
          ),
          key: 'uninstall-button',
          onClick: () => {
            setShowDeleteModel(true);
            setShowActions(false);
            setAction(AppAction.UNINSTALL);
          },
        },
      ]),
];

const getShowMcpConfigTab = (
  appData: App | undefined,
  isAdminUser: boolean | undefined,
  jsonSchema: RJSFSchema | undefined,
  isRuntimeDisabled: boolean
): boolean =>
  Boolean(
    isMcpApplication(appData?.name) &&
      isAdminUser &&
      jsonSchema &&
      !isRuntimeDisabled
  );

const getShowAppConfigTab = (
  showMcpConfigTab: boolean,
  appData: App | undefined,
  jsonSchema: RJSFSchema | undefined,
  isRuntimeDisabled: boolean
): boolean =>
  Boolean(
    !showMcpConfigTab &&
      appData?.appConfiguration &&
      appData.allowConfiguration &&
      jsonSchema &&
      !isRuntimeDisabled
  );

interface ConfigurationTabParams {
  showMcpConfigTab: boolean;
  showAppConfigTab: boolean;
  appData: App | undefined;
  jsonSchema: RJSFSchema | undefined;
  isSaveLoading: boolean;
  onConfigSave: (
    data: IChangeEvent & { ingestionRunner?: EntityReference }
  ) => Promise<void>;
  ApplicationConfigurationComponent: ReturnType<
    typeof applicationsClassBase.getApplicationConfigurationComponent
  >;
  t: TFunc;
}

const getConfigurationTabs = ({
  showMcpConfigTab,
  showAppConfigTab,
  appData,
  jsonSchema,
  isSaveLoading,
  onConfigSave,
  ApplicationConfigurationComponent,
  t,
}: ConfigurationTabParams) => {
  if (!showMcpConfigTab && !showAppConfigTab) {
    return [];
  }

  return [
    {
      label: (
        <TabsLabel
          id={ApplicationTabs.CONFIGURATION}
          name={t('label.configuration')}
        />
      ),
      key: ApplicationTabs.CONFIGURATION,
      children: showMcpConfigTab ? (
        <McpApplicationConfiguration
          appName={appData?.name ?? ''}
          jsonSchema={jsonSchema as RJSFSchema}
        />
      ) : (
        <ApplicationConfigurationComponent
          appData={appData as App}
          isLoading={isSaveLoading}
          jsonSchema={jsonSchema as RJSFSchema}
          onConfigSave={onConfigSave}
        />
      ),
    },
  ];
};

interface ScheduleTabParams {
  showScheduleTab: boolean;
  appData: App | undefined;
  isRuntimeDisabled: boolean;
  runtimeDisabledReason: string | undefined;
  jsonSchema: RJSFSchema | undefined;
  isRunLoading: boolean;
  isDeployLoading: boolean;
  onDemandTrigger: () => Promise<void>;
  onDeployTrigger: () => Promise<void>;
  onAppScheduleSave: (cron: string) => Promise<void>;
  t: TFunc;
}

const getScheduleTabs = ({
  showScheduleTab,
  appData,
  isRuntimeDisabled,
  runtimeDisabledReason,
  jsonSchema,
  isRunLoading,
  isDeployLoading,
  onDemandTrigger,
  onDeployTrigger,
  onAppScheduleSave,
  t,
}: ScheduleTabParams) => {
  if (!showScheduleTab) {
    return [];
  }

  return [
    {
      label: (
        <TabsLabel id={ApplicationTabs.SCHEDULE} name={t('label.schedule')} />
      ),
      key: ApplicationTabs.SCHEDULE,
      children: (
        <div className="bg-white p-lg border-default border-radius-sm">
          {appData && (
            <AppSchedule
              appData={appData}
              disabled={isRuntimeDisabled}
              disabledReason={runtimeDisabledReason}
              jsonSchema={jsonSchema as RJSFSchema}
              loading={{
                isRunLoading,
                isDeployLoading,
              }}
              onDemandTrigger={onDemandTrigger}
              onDeployTrigger={onDeployTrigger}
              onSave={onAppScheduleSave}
            />
          )}
        </div>
      ),
    },
  ];
};

interface RecentRunsTabParams {
  isAppUnavailable: boolean;
  showScheduleTab: boolean;
  appData: App | undefined;
  jsonSchema: RJSFSchema | undefined;
  t: TFunc;
}

const getRecentRunsTabs = ({
  isAppUnavailable,
  showScheduleTab,
  appData,
  jsonSchema,
  t,
}: RecentRunsTabParams) => {
  if (isAppUnavailable || !showScheduleTab) {
    return [];
  }

  return [
    {
      label: (
        <TabsLabel
          id={ApplicationTabs.RECENT_RUNS}
          name={t('label.recent-run-plural')}
        />
      ),
      key: ApplicationTabs.RECENT_RUNS,
      children: (
        <AppRunsHistory
          appData={appData}
          jsonSchema={jsonSchema as RJSFSchema}
        />
      ),
    },
  ];
};

interface LiveIndexingTabParams {
  isAppUnavailable: boolean;
  appData: App | undefined;
  t: TFunc;
}

const getLiveIndexingTabs = ({
  isAppUnavailable,
  appData,
  t,
}: LiveIndexingTabParams) => {
  if (isAppUnavailable || appData?.name !== 'SearchIndexingApplication') {
    return [];
  }

  return [
    {
      label: (
        <TabsLabel
          id={ApplicationTabs.LIVE_INDEXING}
          name={t('label.live-indexing')}
        />
      ),
      key: ApplicationTabs.LIVE_INDEXING,
      children: <AppLiveIndexing appData={appData} />,
    },
  ];
};

const AppDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const [appData, setAppData] = useState<App>();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteModel, setShowDeleteModel] = useState(false);
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();
  const [action, setAction] = useState<AppAction | null>(null);
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({
    isFetchLoading: true,
    isDeployLoading: false,
    isRunLoading: false,
    isSaveLoading: false,
  });
  const { getResourceLimit } = useLimitStore();
  const { plugins } = useApplicationsProvider();
  const { isAdminUser } = useAuth();
  const isRuntimeDisabled = getIsRuntimeDisabled(appData);
  const runtimeDisabledReason = getRuntimeDisabledReason(
    appData,
    isRuntimeDisabled,
    t
  );
  const isAppUnavailable = getIsAppUnavailable(appData, isRuntimeDisabled);

  const fetchAppDetails = useCallback(async () => {
    setLoadingState((prev) => ({ ...prev, isFetchLoading: true }));
    try {
      const data = await getApplicationByName(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINES],
        include: Include.All,
      });
      setAppData(data);

      try {
        const schema = await applicationsClassBase.importSchema(fqn);
        setJsonSchema(schema);
      } catch {
        setJsonSchema(undefined);
        showErrorToast(
          t('server.no-application-schema-found', { appName: fqn })
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingState((prev) => ({ ...prev, isFetchLoading: false }));
    }
  }, [fqn, setLoadingState, t]);

  const onBrowseAppsClick = useCallback(() => {
    navigate(getSettingPath(GlobalSettingOptions.APPLICATIONS));
  }, [navigate]);

  const handleRestore = useCallback(async () => {
    if (appData) {
      try {
        await restoreApp(appData.id);
        showSuccessToast(
          t('message.entity-enabled-success', {
            entity: t('label.application'),
          }),
          2000
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        onBrowseAppsClick();
      }
    }
  }, [appData, onBrowseAppsClick, t]);

  const onConfirmAction = useCallback(async () => {
    try {
      setLoadingState((prev) => ({ ...prev, isSaveLoading: true }));
      if (action === AppAction.ENABLE) {
        handleRestore();
      } else {
        await uninstallApp(
          appData?.fullyQualifiedName ?? '',
          action === AppAction.UNINSTALL
        );

        showSuccessToast(
          action === AppAction.DISABLE
            ? t('message.app-disabled-successfully')
            : t('message.app-uninstalled-successfully')
        );

        // Update current count when Create / Delete operation performed
        await getResourceLimit('app', true, true);

        onBrowseAppsClick();
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setLoadingState((prev) => ({ ...prev, isSaveLoading: false }));
    }
  }, [
    action,
    appData,
    getResourceLimit,
    handleRestore,
    onBrowseAppsClick,
    setLoadingState,
    t,
  ]);

  const manageButtonContent: ItemType[] = getManageButtonContent(appData, t, {
    setShowActions,
    setAction,
    setShowDeleteModel,
  });

  const onConfigSave = useCallback(
    async (data: IChangeEvent & { ingestionRunner?: EntityReference }) => {
      if (appData) {
        setLoadingState((prev) => ({ ...prev, isSaveLoading: true }));

        const { formData, ingestionRunner } = data;

        const updatedFormData = formatFormDataForSubmit(formData);
        const updatedData = {
          ...appData,
          appConfiguration: updatedFormData,
          ...(ingestionRunner && { ingestionRunner }),
        };

        const jsonPatch = compare(appData, updatedData);

        try {
          const response = await patchApplication(appData.id, jsonPatch);
          // call configure endpoint also to update configuration
          await configureApp(appData.fullyQualifiedName ?? '', updatedFormData);
          setAppData(response);
          showSuccessToast(
            t('message.entity-saved-successfully', {
              entity: t('label.configuration'),
            })
          );
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setLoadingState((prev) => ({ ...prev, isSaveLoading: false }));
        }
      }
    },
    [appData, t]
  );

  const onAppScheduleSave = useCallback(
    async (cron: string) => {
      if (appData) {
        const updatedData = {
          ...appData,
          appSchedule: {
            scheduleTimeline: isEmpty(cron)
              ? ScheduleTimeline.None
              : ScheduleTimeline.Custom,
            ...(cron ? { cronExpression: cron } : {}),
          },
        };

        const jsonPatch = compare(appData, updatedData);

        try {
          const response = await patchApplication(appData.id, jsonPatch);
          setAppData(response);
          showSuccessToast(
            t('message.entity-saved-successfully', {
              entity: t('label.schedule'),
            })
          );
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [appData, t]
  );

  const onDemandTrigger = useCallback(async () => {
    try {
      setLoadingState((prev) => ({ ...prev, isRunLoading: true }));
      await triggerOnDemandApp(appData?.fullyQualifiedName ?? '');
      showSuccessToast(
        t('message.application-action-successfully', {
          action: t('label.triggered-lowercase'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingState((prev) => ({ ...prev, isRunLoading: false }));
    }
  }, [appData?.fullyQualifiedName, t]);

  const onDeployTrigger = useCallback(async () => {
    try {
      setLoadingState((prev) => ({ ...prev, isDeployLoading: true }));
      await deployApp(appData?.fullyQualifiedName ?? '');
      showSuccessToast(
        t('message.application-action-successfully', {
          action: t('label.deploy'),
        })
      );
      fetchAppDetails();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingState((prev) => ({ ...prev, isDeployLoading: false }));
    }
  }, [appData?.fullyQualifiedName, fetchAppDetails, t]);

  // Check if there's a plugin app details component for this app
  const pluginAppDetailsComponent = useMemo(() => {
    if (!appData?.name || !plugins.length) {
      return null;
    }

    const plugin = plugins.find((p) => p.name === appData.name);

    return plugin?.getAppDetails?.(appData) || null;
  }, [appData?.name, plugins]);

  const tabs = useMemo(() => {
    const ApplicationConfigurationComponent =
      applicationsClassBase.getApplicationConfigurationComponent();
    const showScheduleTab = appData?.scheduleType !== ScheduleType.NoSchedule;

    // The MCP app stores no configuration of its own. Its settings live in the `mcpConfiguration`
    // system setting, which is admin-only, so its tab uses a dedicated component and is hidden
    // from non-admins rather than letting them submit a request the server will reject.
    const showMcpConfigTab = getShowMcpConfigTab(
      appData,
      isAdminUser,
      jsonSchema,
      isRuntimeDisabled
    );
    const showAppConfigTab = getShowAppConfigTab(
      showMcpConfigTab,
      appData,
      jsonSchema,
      isRuntimeDisabled
    );

    return [
      ...getScheduleTabs({
        showScheduleTab,
        appData,
        isRuntimeDisabled,
        runtimeDisabledReason,
        jsonSchema,
        isRunLoading: loadingState.isRunLoading,
        isDeployLoading: loadingState.isDeployLoading,
        onDemandTrigger,
        onDeployTrigger,
        onAppScheduleSave,
        t,
      }),
      ...getConfigurationTabs({
        showMcpConfigTab,
        showAppConfigTab,
        appData,
        jsonSchema,
        isSaveLoading: loadingState.isSaveLoading,
        onConfigSave,
        ApplicationConfigurationComponent,
        t,
      }),
      ...getRecentRunsTabs({
        isAppUnavailable,
        showScheduleTab,
        appData,
        jsonSchema,
        t,
      }),
      ...getLiveIndexingTabs({ isAppUnavailable, appData, t }),
    ];
  }, [
    appData,
    isAdminUser,
    isAppUnavailable,
    isRuntimeDisabled,
    jsonSchema,
    loadingState.isDeployLoading,
    loadingState.isRunLoading,
    loadingState.isSaveLoading,
    onAppScheduleSave,
    onConfigSave,
    onDemandTrigger,
    onDeployTrigger,
    runtimeDisabledReason,
    t,
  ]);

  const actionText = useMemo(() => {
    switch (action) {
      case AppAction.ENABLE:
        return t('label.enable-lowercase');
      case AppAction.DISABLE:
        return t('label.disable-lowercase');
      case AppAction.UNINSTALL:
        return t('label.uninstall-lowercase');
      default:
        return '';
    }
  }, [action, t]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (loadingState.isFetchLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="app-details-page-layout"
      pageTitle={getEntityName(appData) || t('label.application-plural')}>
      <Row>
        <Col className="d-flex" flex="auto">
          <Button
            className="p-0"
            icon={<LeftOutlined />}
            size="small"
            type="text"
            onClick={onBrowseAppsClick}>
            <Typography.Text className="font-medium">
              {t('label.browse-app-plural')}
            </Typography.Text>
          </Button>
        </Col>
        <Col flex="360px">
          <div className="d-flex gap-2 justify-end">
            <Dropdown
              align={{ targetOffset: [-12, 0] }}
              className="m-l-xs"
              menu={{
                items: manageButtonContent,
              }}
              open={showActions}
              overlayClassName="glossary-manage-dropdown-list-container"
              overlayStyle={{ width: '350px' }}
              placement="bottomRight"
              trigger={['click']}
              onOpenChange={setShowActions}>
              <Tooltip
                placement="topRight"
                title={t('label.manage-entity', {
                  entity: t('label.application'),
                })}>
                <Button
                  className="glossary-manage-dropdown-button p-x-xs"
                  data-testid="manage-button"
                  icon={
                    <IconDropdown className="vertical-align-inherit manage-dropdown-icon" />
                  }
                  onClick={() => setShowActions(true)}
                />
              </Tooltip>
            </Dropdown>
          </div>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Space className="app-details-header w-full" size={24}>
            <AppLogo appName={appData?.fullyQualifiedName ?? ''} />

            <div className="w-full">
              <Typography.Title level={4}>
                {getEntityName(appData)}
              </Typography.Title>
              {isRuntimeDisabled && (
                <Tooltip title={runtimeDisabledReason}>
                  <div
                    className="deleted-badge-button text-xs flex-center app-runtime-disabled-badge"
                    data-testid="runtime-disabled-badge">
                    <StopOutlined className="d-flex m-r-xss font-medium text-xs" />
                    {t('label.disabled')}
                  </div>
                </Tooltip>
              )}

              <div className="d-flex items-center flex-wrap gap-6">
                <Space size={8}>
                  <ClockCircleOutlined />
                  <Typography.Text className="text-xs text-grey-muted">
                    {`${t('label.installed')} ${getRelativeTime(
                      appData?.updatedAt
                    )}`}
                  </Typography.Text>
                </Space>

                <Space size={8}>
                  <UserOutlined />
                  <Typography.Text className="text-xs text-grey-muted">
                    {t('label.developed-by-developer', {
                      developer: appData?.developer,
                    })}
                  </Typography.Text>
                </Space>

                {appData?.developerUrl && (
                  <div className="flex-center gap-2">
                    <Icon component={IconExternalLink} style={ICON_DIMENSION} />
                    <Typography.Link
                      className="text-xs"
                      href={appData?.developerUrl}
                      target="_blank">
                      <Space>{t('label.visit-developer-website')}</Space>
                    </Typography.Link>
                  </div>
                )}
              </div>
            </div>
          </Space>
        </Col>
        <Col className="app-details-page-tabs" span={24}>
          {pluginAppDetailsComponent ? (
            // Render plugin's custom app details component
            React.createElement(pluginAppDetailsComponent)
          ) : (
            // Render default tabs interface
            <Tabs
              destroyInactiveTabPane
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
            />
          )}
        </Col>
      </Row>

      <ConfirmationModal
        bodyText={t('message.are-you-sure-action-property', {
          action: actionText,
          propertyName: getEntityName(appData),
        })}
        cancelText={t('label.cancel')}
        confirmText={t('label.ok')}
        header={t('message.are-you-sure')}
        isLoading={loadingState.isSaveLoading}
        visible={showDeleteModel}
        onCancel={() => setShowDeleteModel(false)}
        onConfirm={onConfirmAction}
      />
    </PageLayoutV1>
  );
};

export default AppDetails;
