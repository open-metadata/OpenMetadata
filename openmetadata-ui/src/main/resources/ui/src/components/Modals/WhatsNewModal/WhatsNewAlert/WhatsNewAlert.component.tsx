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
import { Affix, Button, Card, Space, Typography } from 'antd';
import { CookieStorage } from 'cookie-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { ReactComponent as RocketIcon } from '../../../../assets/svg/rocket.svg';
import { ROUTES } from '../../../../constants/constants';
import { useAuth } from '../../../../hooks/authHooks';
import { Transi18next } from '../../../../utils/CommonUtils';
import { getReleaseVersionExpiry } from '../../../../utils/WhatsNewModal.util';
import '../whats-new-modal.less';
import { COOKIE_VERSION, LATEST_VERSION_ID, WHATS_NEW } from '../whatsNewData';
import WhatsNewModal from '../WhatsNewModal';

const cookieStorage = new CookieStorage();

const WhatsNewAlert = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isFirstTimeUser } = useAuth(location.pathname);
  const [showWhatsNew, setShowWhatsNew] = useState({
    alert: false,
    modal: false,
  });

  const latestVersion = useMemo(
    () => WHATS_NEW[LATEST_VERSION_ID],
    [WHATS_NEW, LATEST_VERSION_ID]
  );
  const isHomePage = useMemo(
    () => location.pathname.includes(ROUTES.MY_DATA),
    [location.pathname]
  );

  useEffect(() => {
    setShowWhatsNew({
      alert: cookieStorage.getItem(COOKIE_VERSION) !== 'true',
      modal: false,
    });
  }, [isFirstTimeUser]);

  const onAlertCardClick = () => {
    setShowWhatsNew({
      alert: false,
      modal: true,
    });
  };
  const onModalCancel = () => {
    setShowWhatsNew({
      alert: false,
      modal: false,
    });
  };
  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cookieStorage.setItem(COOKIE_VERSION, 'true', {
      expires: getReleaseVersionExpiry(),
    });
    onModalCancel();
  };

  return (
    <>
      {showWhatsNew.alert && isHomePage && (
        <Affix className="whats-new-alert-container">
          <Card
            className="cursor-pointer"
            data-testid="whats-new-alert-card"
            onClick={onAlertCardClick}>
            <Space align="start" className="d-flex justify-between">
              <Space size={14}>
                <RocketIcon color="#fff" height={42} width={42} />
                <Typography.Text className="whats-new-alert-header">
                  <Transi18next
                    i18nKey="message.version-released-try-now"
                    renderElement={<div />}
                    values={{
                      version: latestVersion.version,
                    }}
                  />
                </Typography.Text>
              </Space>
              <Button
                className="flex-center m--t-xss"
                data-testid="close-whats-new-alert"
                icon={<CloseIcon color="#fff" height={12} width={12} />}
                type="text"
                onClick={handleCancel}
              />
            </Space>

            {latestVersion?.shortSummary ? (
              <Typography.Paragraph
                className="whats-new-alert-description"
                style={{ marginBottom: 0, marginTop: '8px' }}>
                {latestVersion?.shortSummary}
              </Typography.Paragraph>
            ) : (
              ''
            )}
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
