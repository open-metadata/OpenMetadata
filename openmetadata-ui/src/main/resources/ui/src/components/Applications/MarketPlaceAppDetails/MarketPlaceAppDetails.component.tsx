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
import { LeftOutlined } from '@ant-design/icons';
import { Button, Carousel, Col, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as CheckMarkIcon } from '../../../assets/svg/ic-cloud-checkmark.svg';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import Loader from '../../../components/Loader/Loader';
import { ROUTES } from '../../../constants/constants';
import { AppMarketPlaceDefinition } from '../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { Include } from '../../../generated/type/include';
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
  const [appScreenshots, setAppScreenshots] = useState<JSX.Element[]>([]);

  const loadScreenshot = async (screenshotName: string) => {
    try {
      const imageModule = await import(
        `../../../assets/img/appScreenshots/${screenshotName}`
      );
      const imageSrc = imageModule.default;

      return (
        <img alt={screenshotName} src={imageSrc} style={{ height: '320px' }} />
      );
    } catch (error) {
      return <></>;
    }
  };

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByName(fqn, 'owner');
      setAppData(data);

      if (data.appScreenshots) {
        // Create an array of promises to load the screenshots
        const screenshotPromises = data.appScreenshots.map(
          (screenshotUrl: string) => loadScreenshot(screenshotUrl)
        );

        // Wait for all promises to resolve
        const screenshotElements: JSX.Element[] = await Promise.all(
          screenshotPromises
        );

        // Update appScreenshots with the loaded screenshot elements
        setAppScreenshots(screenshotElements);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  const fetchInstalledAppDetails = useCallback(async () => {
    try {
      await getApplicationByName(fqn, {
        fields: 'owner',
        include: Include.All,
      });
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
          className="p-0"
          icon={<LeftOutlined />}
          size="small"
          type="text"
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
            block
            className="m-t-md"
            data-testid="install-application"
            disabled={isInstalled}
            type="primary"
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
          <Typography.Title className="p-md m-0 p-t-xss" level={2}>
            {getEntityName(appData)}
          </Typography.Title>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Carousel
            autoplay
            dots
            autoplaySpeed={3000}
            className="p-x-md"
            easing="ease-in-out">
            {appScreenshots.map((data) => (
              <div
                className="app-slider-container"
                data-testid="slider-container"
                key={uniqueId()}>
                {data}
              </div>
            ))}
          </Carousel>
        </Col>

        <Col span={24}>
          <div className="p-md">
            <RichTextEditorPreviewer
              enableSeeMoreVariant={false}
              markdown={appData?.description ?? ''}
            />
          </div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default MarketPlaceAppDetails;
