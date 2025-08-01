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
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Include } from '../../../../generated/type/include';
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
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import { getSettingPath } from '../../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import TabsLabel from '../../../common/TabsLabel/TabsLabel.component';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import ApplicationConfiguration from '../ApplicationConfiguration/ApplicationConfiguration';
import AppLogo from '../AppLogo/AppLogo.component';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import AppSchedule from '../AppSchedule/AppSchedule.component';
import { ApplicationTabs } from '../MarketPlaceAppDetails/MarketPlaceAppDetails.interface';
import './app-details.less';
import { AppAction } from './AppDetails.interface';
import applicationsClassBase from './ApplicationsClassBase';

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

  const fetchAppDetails = useCallback(async () => {
    setLoadingState((prev) => ({ ...prev, isFetchLoading: true }));
    try {
      const data = await getApplicationByName(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINES],
        include: Include.All,
      });
      setAppData(data);

      const schema = await applicationsClassBase.importSchema(fqn);

      setJsonSchema(schema.default);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingState((prev) => ({ ...prev, isFetchLoading: false }));
    }
  }, [fqn, setLoadingState]);

  const onBrowseAppsClick = () => {
    navigate(getSettingPath(GlobalSettingOptions.APPLICATIONS));
  };

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
  }, [appData]);

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
  }, [appData, action, setLoadingState]);

  const manageButtonContent: ItemType[] = [
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
            onClick: (e) => {
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

  const onConfigSave = async (data: IChangeEvent) => {
    if (appData) {
      setLoadingState((prev) => ({ ...prev, isSaveLoading: true }));
      const updatedFormData = formatFormDataForSubmit(data.formData);
      const updatedData = {
        ...appData,
        appConfiguration: updatedFormData,
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
  };

  const onAppScheduleSave = async (cron: string) => {
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
  };

  const onDemandTrigger = async () => {
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
  };

  const onDeployTrigger = async () => {
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
  };

  const tabs = useMemo(() => {
    const tabConfiguration =
      appData?.appConfiguration && appData.allowConfiguration && jsonSchema
        ? [
            {
              label: (
                <TabsLabel
                  id={ApplicationTabs.CONFIGURATION}
                  name={t('label.configuration')}
                />
              ),
              key: ApplicationTabs.CONFIGURATION,
              children: (
                <ApplicationConfiguration
                  appData={appData}
                  isLoading={loadingState.isSaveLoading}
                  jsonSchema={jsonSchema}
                  onConfigSave={onConfigSave}
                />
              ),
            },
          ]
        : [];

    const showScheduleTab = appData?.scheduleType !== ScheduleType.NoSchedule;

    return [
      ...(showScheduleTab
        ? [
            {
              label: (
                <TabsLabel
                  id={ApplicationTabs.SCHEDULE}
                  name={t('label.schedule')}
                />
              ),
              key: ApplicationTabs.SCHEDULE,
              children: (
                <div className="bg-white p-lg border-default border-radius-sm">
                  {appData && (
                    <AppSchedule
                      appData={appData}
                      jsonSchema={jsonSchema as RJSFSchema}
                      loading={{
                        isRunLoading: loadingState.isRunLoading,
                        isDeployLoading: loadingState.isDeployLoading,
                      }}
                      onDemandTrigger={onDemandTrigger}
                      onDeployTrigger={onDeployTrigger}
                      onSave={onAppScheduleSave}
                    />
                  )}
                </div>
              ),
            },
          ]
        : []),
      ...tabConfiguration,
      ...(!appData?.deleted && showScheduleTab
        ? [
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
          ]
        : []),
    ];
  }, [appData, jsonSchema, loadingState]);

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
  }, [action]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (loadingState.isFetchLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="app-details-page-layout"
      pageTitle={t('label.application-plural')}>
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
          <Tabs
            destroyInactiveTabPane
            className="tabs-new"
            data-testid="tabs"
            items={tabs}
          />
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
