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
import { Affix, Button, Card, Col, Row, Space, Typography } from 'antd';
import { CookieStorage } from 'cookie-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { ReactComponent as RightArrowIcon } from '../../../../assets/svg/ic-arrow-right-full.svg';
import { ReactComponent as PlayIcon } from '../../../../assets/svg/ic-play-button.svg';
import { BLACK_COLOR, ROUTES } from '../../../../constants/constants';
import { useAuth } from '../../../../hooks/authHooks';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';
import { getReleaseVersionExpiry } from '../../../../utils/WhatsNewModal.util';
import { COOKIE_VERSION, WHATS_NEW } from '../whatsNewData';
import WhatsNewModal from '../WhatsNewModal';

const cookieStorage = new CookieStorage();

const WhatsNewAlert = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { isFirstTimeUser } = useAuth();
  const [showWhatsNew, setShowWhatsNew] = useState({
    alert: false,
    modal: false,
  });

  const latestVersion = useMemo(
    () => WHATS_NEW[WHATS_NEW.length - 1], // latest version will be last in the array
    [WHATS_NEW]
  );
  const isHomePage = useMemo(
    () => location.pathname.includes(ROUTES.MY_DATA),
    [location.pathname]
  );

  const onAlertCardClick = useCallback(
    () =>
      setShowWhatsNew({
        alert: false,
        modal: true,
      }),
    []
  );

  const onModalCancel = useCallback(
    () =>
      setShowWhatsNew({
        alert: false,
        modal: false,
      }),
    []
  );

  const handleCancel = useCallback(() => {
    cookieStorage.setItem(COOKIE_VERSION, 'true', {
      expires: getReleaseVersionExpiry(),
    });
    onModalCancel();
  }, [cookieStorage, onModalCancel, getReleaseVersionExpiry]);

  useEffect(() => {
    setShowWhatsNew({
      alert: cookieStorage.getItem(COOKIE_VERSION) !== 'true',
      modal: false,
    });
  }, [isFirstTimeUser]);

  const title = useMemo(() => {
    return brandClassBase.getPageTitle();
  }, []);

  return (
    <>
      {showWhatsNew.alert && isHomePage && (
        <Affix className="whats-new-alert-container">
          <Card className="cursor-pointer" data-testid="whats-new-alert-card">
            <Space align="start" className="d-flex justify-between">
              <Typography.Text
                className="whats-new-alert-header"
                data-testid="whats-new-alert-header">
                {t('label.brand-updated', {
                  brandName: title,
                })}
              </Typography.Text>
              <Button
                className="flex-center m--t-xss"
                data-testid="close-whats-new-alert"
                icon={<CloseIcon color={BLACK_COLOR} height={12} width={12} />}
                type="text"
                onClick={handleCancel}
              />
            </Space>

            <Row className="m-t-sm" gutter={[0, 12]}>
              <Col className="whats-new-alert-content" span={24}>
                <Space align="center" size={12} onClick={onAlertCardClick}>
                  <div className="whats-new-alert-content-icon-container">
                    <PlayIcon className="whats-new-alert-content-icon" />
                  </div>

                  <Typography.Text className="whats-new-alert-sub-header">
                    {t('label.whats-new-version', {
                      version: latestVersion.version,
                    })}
                  </Typography.Text>

                  <RightArrowIcon className="whats-new-alert-content-icon-arrow" />
                </Space>
              </Col>
            </Row>
          </Card>
        </Affix>
      )}
      <WhatsNewModal
        header={`${t('label.whats-new')}!`}
        visible={showWhatsNew.modal}
        onCancel={onModalCancel}
      />
    </>
  );
};

export default WhatsNewAlert;
