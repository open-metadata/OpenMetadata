import { LeftOutlined } from '@ant-design/icons';
import { Avatar, Button, Col, Row, Typography } from 'antd';
import { ReactComponent as AppIcon } from '../../../assets/svg/application.svg';
import { ReactComponent as CheckMarkIcon } from '../../../assets/svg/ic-cloud-checkmark.svg';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import Loader from '../../../components/Loader/Loader';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import { ROUTES } from '../../../constants/constants';
import { AppMarketPlaceDefinition } from '../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { getMarketPlaceApplicationByName } from '../../../rest/applicationMarketPlaceAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getAppInstallPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './market-place-app-details.less';

const MarketPlaceAppDetails = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn, tab: activeTab } = useParams<{ fqn: string; tab: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByName(fqn, 'owner');
      setAppData(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  // const handleTabChange = (activeKey: string) => {
  //   if (activeKey !== activeTab) {
  //     history.push(getMarketPlaceAppDetailsPath(fqn, activeKey));
  //   }
  // };

  const installApp = useCallback(() => {
    history.push(getAppInstallPath(fqn));
  }, [fqn]);

  // const tabs = useMemo(() => {
  //   return [
  //     {
  //       label: (
  //         <TabsLabel
  //           id={ApplicationTabs.DESCRIPTION}
  //           name={t('label.description')}
  //         />
  //       ),
  //       key: ApplicationTabs.DESCRIPTION,
  //       children: (
  //         <div className="p-md">
  //           <RichTextEditorPreviewer markdown={appData?.description ?? ''} />
  //         </div>
  //       ),
  //     },
  //     {
  //       label: (
  //         <TabsLabel
  //           id={ApplicationTabs.FEATURES}
  //           name={t('label.feature-plural')}
  //         />
  //       ),
  //       key: ApplicationTabs.FEATURES,
  //       children: <span>FEATURES</span>,
  //     },
  //     {
  //       label: (
  //         <TabsLabel
  //           id={ApplicationTabs.PERMISSIONS}
  //           name={t('label.permission-plural')}
  //         />
  //       ),
  //       key: ApplicationTabs.PERMISSIONS,
  //       children: <span>PERMISSIONS</span>,
  //     },
  //   ];
  // }, [activeTab, appData]);

  const onBrowseAppsClick = () => {
    history.push(ROUTES.MARKETPLACE);
  };

  const leftPanel = useMemo(() => {
    return (
      <div className="p-x-md p-t-md ">
        <Button
          size="small"
          className="p-0"
          type="text"
          icon={<LeftOutlined />}
          onClick={onBrowseAppsClick}>
          <Typography.Text className="font-medium">
            {t('label.browse-app-plural')}
          </Typography.Text>
        </Button>

        <div className="flex-center m-t-md">
          <Avatar
            className="flex-center bg-white border"
            size={120}
            icon={<AppIcon color="#000" width={64} height={64} />}
          />
        </div>
        <Button className="m-t-md" type="primary" block onClick={installApp}>
          {t('label.install')}
        </Button>

        <div className="m-t-md">
          <CheckMarkIcon className="v-middle m-r-xss" />
          <Typography.Text className="text-xs font-medium text-grey-muted">
            {t('message.marketplace-verify-msg')}
          </Typography.Text>
        </div>

        {/* <Space className="p-t-lg" direction="vertical" size={8}>
          <Typography.Text
            className="right-panel-label"
            data-testid="learn-more-and-support-heading-name">
            {t('label.learn-more-and-support')}
          </Typography.Text>
          <Typography.Text>
            {appData?.supportEmail && (
              <Typography.Link href={appData?.supportEmail} target="_blank">
                <Space>{t('label.get-app-support')}</Space>
              </Typography.Link>
            )}
            {appData?.developerUrl && (
              <Typography.Link href={appData?.developerUrl} target="_blank">
                <Space>{t('label.visit-developer-website')}</Space>
              </Typography.Link>
            )}
            {appData?.privacyPolicyUrl && (
              <Typography.Link href={appData?.privacyPolicyUrl} target="_blank">
                <Space>{t('label.privacy-policy')}</Space>
              </Typography.Link>
            )}
          </Typography.Text>
        </Space> */}
      </div>
    );
  }, [appData]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      leftPanel={leftPanel}
      leftPanelWidth={260}
      pageTitle={t('label.application-plural')}>
      <Row>
        <Col span={24}>
          <Typography.Title className="p-md" level={4}>
            {getEntityName(appData)}
          </Typography.Title>
        </Col>
        <Col span={24}>
          <div className="p-md">
            <RichTextEditorPreviewer markdown={appData?.description ?? ''} />
          </div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default MarketPlaceAppDetails;
