import {
  ClockCircleOutlined,
  LeftOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
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
import { noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
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
import { ServiceCategory } from '../../../enums/service.enum';
import { App } from '../../../generated/entity/applications/app';
import {
  getApplicationByName,
  patchApplication,
  unistallApp,
} from '../../../rest/applicationAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { formatFormDataForSubmit } from '../../../utils/JSONSchemaFormUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import FormBuilder from '../../common/FormBuilder/FormBuilder';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import AppLogo from '../AppLogo/AppLogo.component';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import AppSchedule from '../AppSchedule/AppSchedule.component';
import { ApplicationTabs } from '../MarketPlaceAppDetails/MarketPlaceAppDetails.interface';
import './app-details.less';

const AppDetails = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<App>();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteModel, setShowDeleteModel] = useState(false);
  const [isAppDisableAction, setIsAppDisableAction] = useState(false);
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApplicationByName(fqn, 'owner');
      setAppData(data);
      const schema = await import(
        `../../../utils/ApplicationSchemas/${fqn}.json`
      );
      setJsonSchema(schema);
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
  }, [appData, isAppDisableAction]);

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

  const onConfigSave = async (data: IChangeEvent) => {
    if (appData) {
      const updatedFormData = formatFormDataForSubmit(data.formData);
      const updatedData = {
        ...appData,
        appConfiguration: updatedFormData,
      };

      const jsonPatch = compare(appData, updatedData);

      try {
        const response = await patchApplication(appData.id, jsonPatch);
        setAppData(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

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
          <TabsLabel
            id={ApplicationTabs.CONFIGURATION}
            name={t('label.configuration')}
          />
        ),
        key: ApplicationTabs.CONFIGURATION,
        children: (
          <div>
            {jsonSchema && appData && (
              <FormBuilder
                formData={appData.appConfiguration}
                cancelText={t('label.back')}
                okText={t('label.submit')}
                disableTestConnection={true}
                serviceType={''}
                serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
                schema={jsonSchema}
                useSelectWidget
                validator={validator}
                showTestConnection={false}
                onCancel={noop}
                onSubmit={onConfigSave}
              />
            )}
          </div>
        ),
      },
      {
        label: (
          <TabsLabel id={ApplicationTabs.HISTORY} name={t('label.history')} />
        ),
        key: ApplicationTabs.HISTORY,
        children: (
          <div className="p-y-md">
            <AppRunsHistory />
          </div>
        ),
      },
    ];
  }, [appData, jsonSchema]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
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
  );
};

export default AppDetails;
