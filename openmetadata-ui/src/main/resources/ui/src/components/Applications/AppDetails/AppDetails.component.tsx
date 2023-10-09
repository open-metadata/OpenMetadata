import {
  ClockCircleOutlined,
  LeftOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Col, Row, Space, Tabs, Typography } from 'antd';
import { ReactComponent as AppIcon } from 'assets/svg/application.svg';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-links.svg';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import Loader from '../../../components/Loader/Loader';
import TabsLabel from '../../../components/TabsLabel/TabsLabel.component';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import { App } from '../../../generated/entity/applications/app';
import { getApplicationByName } from '../../../rest/applicationAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { ApplicationTabs } from '../MarketPlaceAppDetails/MarketPlaceAppDetails.interface';
import './app-details.less';

const AppDetails = () => {
  const { t } = useTranslation();

  const { fqn } = useParams<{ fqn: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<App>();

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

  const tabs = useMemo(() => {
    return [
      {
        label: (
          <TabsLabel id={ApplicationTabs.SCHEDULE} name={t('label.schedule')} />
        ),
        key: ApplicationTabs.SCHEDULE,
        children: <div className="p-md"></div>,
      },
      {
        label: (
          <TabsLabel
            id={ApplicationTabs.PERMISSIONS}
            name={t('label.permission-plural')}
          />
        ),
        key: ApplicationTabs.PERMISSIONS,
        children: <span>PERMISSIONS</span>,
      },
      {
        label: (
          <TabsLabel id={ApplicationTabs.HISTORY} name={t('label.history')} />
        ),
        key: ApplicationTabs.HISTORY,
        children: <span>HISTORY</span>,
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
    <PageLayoutV1
      className="app-details-page-layout p-0"
      pageTitle={t('label.application-plural')}>
      <Row>
        <Col span={24}>
          <Button
            size="small"
            className="p-0"
            type="text"
            icon={<LeftOutlined />}>
            <Typography.Text className="font-medium">
              {t('label.browse-app-plural')}
            </Typography.Text>
          </Button>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Space className="app-details-header w-full m-t-md" size={24}>
            <Avatar
              className="flex-center bg-white border"
              size={120}
              icon={<AppIcon color="#000" width={64} height={64} />}
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
                    {`${t('label.developed-by')} ${appData?.developer}`}
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
    </PageLayoutV1>
  );
};
export default AppDetails;
