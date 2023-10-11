import { LeftOutlined } from '@ant-design/icons';
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as CheckMarkIcon } from '../../../assets/svg/ic-cloud-checkmark.svg';
import Loader from '../../../components/Loader/Loader';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import { ROUTES } from '../../../constants/constants';
import { AppMarketPlaceDefinition } from '../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { getApplicationByName } from '../../../rest/applicationAPI';
import { getMarketPlaceApplicationByName } from '../../../rest/applicationMarketPlaceAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getAppInstallPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AppLogo from '../AppLogo/AppLogo.component';
import './market-place-app-details.less';

const MarketPlaceAppDetails = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isInstalled, setIsInstalled] = useState(false);

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

  const fetchInstalledAppDetails = useCallback(async () => {
    try {
      await getApplicationByName(fqn, 'owner');
      setIsInstalled(true);
    } catch (error) {
      setIsInstalled(false);
    }
  }, [fqn]);

  const installApp = useCallback(() => {
    history.push(getAppInstallPath(fqn));
  }, [fqn]);

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
          <AppLogo appName={appData?.fullyQualifiedName ?? ''} />
        </div>
        <Tooltip
          placement="top"
          title={isInstalled ? t('message.app-already-installed') : ''}
          trigger="hover">
          <Button
            className="m-t-md"
            disabled={isInstalled}
            type="primary"
            block
            onClick={installApp}>
            {t('label.install')}
          </Button>
        </Tooltip>

        <div className="m-t-md">
          <CheckMarkIcon className="v-middle m-r-xss" />
          <Typography.Text className="text-xs font-medium text-grey-muted">
            {t('message.marketplace-verify-msg')}
          </Typography.Text>
        </div>

        <Space className="p-t-lg" direction="vertical" size={8}>
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
        </Space>
      </div>
    );
  }, [appData, isInstalled]);

  useEffect(() => {
    fetchAppDetails();
    fetchInstalledAppDetails();
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
