import {
  ClockCircleOutlined,
  LeftOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as AppIcon } from '../../../assets/svg/application.svg';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import Loader from '../../../components/Loader/Loader';
import TabsLabel from '../../../components/TabsLabel/TabsLabel.component';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { App } from '../../../generated/entity/applications/app';
import {
  getApplicationByName,
  unistallApp,
} from '../../../rest/applicationAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import { ApplicationTabs } from '../MarketPlaceAppDetails/MarketPlaceAppDetails.interface';
import './app-details.less';
import AppSchedule from '../AppSchedule/AppSchedule.component';

const AppDetails = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<App>();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteModel, setShowDeleteModel] = useState(false);
  const [isAppDisableAction, setIsAppDisableAction] = useState(false);

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApplicationByName(fqn, 'owner');
      setAppData(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  const onBrowseAppsClick = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.WORKFLOW,
        GlobalSettingOptions.APPLICATIONS
      )
    );
  };

  const onConfirmAction = useCallback(async () => {
    try {
      await unistallApp(appData?.fullyQualifiedName ?? '', !isAppDisableAction);
      onBrowseAppsClick();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [isAppDisableAction]);

  const manageButtonContent: ItemType[] = [
    {
      label: (
        <ManageButtonItemLabel
          description={t('message.disable-app', {
            app: getEntityName(appData),
          })}
          icon={<StopOutlined color={DE_ACTIVE_COLOR} width="18px" />}
          id="disable-button"
          name={t('label.disable')}
        />
      ),
      key: 'disable-button',
      onClick: (e) => {
        e.domEvent.stopPropagation();
        setShowDeleteModel(true);
        setIsAppDisableAction(true);
      },
    },
    {
      label: (
        <ManageButtonItemLabel
          description={t('message.uninstall-app', {
            app: getEntityName(appData),
          })}
          icon={<DeleteIcon color={DE_ACTIVE_COLOR} width="18px" />}
          id="uninstall-button"
          name={t('label.uninstall')}
        />
      ),
      key: 'uninstall-button',
      onClick: (e) => {
        e.domEvent.stopPropagation();
        setShowDeleteModel(true);
        setIsAppDisableAction(false);
      },
    },
  ];

  const tabs = useMemo(() => {
    return [
      {
        label: (
          <TabsLabel id={ApplicationTabs.SCHEDULE} name={t('label.schedule')} />
        ),
        key: ApplicationTabs.SCHEDULE,
        children: (
          <div className="p-y-md">
            {appData && <AppSchedule appData={appData} />}
          </div>
        ),
      },
      {
        label: (
          <TabsLabel id={ApplicationTabs.HISTORY} name={t('label.history')} />
        ),
        key: ApplicationTabs.HISTORY,
        children: (
          <div className="p-md">
            <AppRunsHistory />
          </div>
        ),
      },
    ];
  }, [appData]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <PageLayoutV1
        className="app-details-page-layout p-0"
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
                <Tooltip placement="right">
                  <Button
                    className="glossary-manage-dropdown-button tw-px-1.5"
                    data-testid="manage-button"
                    onClick={() => setShowActions(true)}>
                    <IconDropdown className="anticon self-center manage-dropdown-icon" />
                  </Button>
                </Tooltip>
              </Dropdown>
            </div>
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <Space className="app-details-header w-full m-t-md" size={24}>
              <Avatar
                className="flex-center bg-white border"
                icon={<AppIcon color="#000" height={64} width={64} />}
                size={120}
              />

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
                      <IconExternalLink width={12} />
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
          <Col span={24}>
            <Tabs
              destroyInactiveTabPane
              className="app-details-page-tabs"
              data-testid="tabs"
              items={tabs}
            />
          </Col>
        </Row>

        <ConfirmationModal
          bodyText={t('message.are-you-sure-action-property', {
            action: isAppDisableAction
              ? t('label.disable')
              : t('label.uninstall'),
            propertyName: getEntityName(appData),
          })}
          cancelText={t('label.cancel')}
          confirmText={t('label.ok')}
          header={t('message.are-you-sure')}
          visible={showDeleteModel}
          onCancel={() => setShowDeleteModel(false)}
          onConfirm={onConfirmAction}
        />
      </PageLayoutV1>
    </>
  );
};

export default AppDetails;
