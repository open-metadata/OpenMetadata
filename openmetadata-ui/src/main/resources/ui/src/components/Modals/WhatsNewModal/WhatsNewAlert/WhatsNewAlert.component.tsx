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
import { Affix, Button, Card, Col, Row, Typography } from 'antd';
import { CookieStorage } from 'cookie-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { ReactComponent as RocketIcon } from '../../../../assets/svg/rocket.svg';
import { ROUTES, VERSION } from '../../../../constants/constants';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';
import { getVersionedStorageKey } from '../../../../utils/Version/version';
import { getReleaseVersionExpiry } from '../../../../utils/WhatsNewModal.util';
import './WhatsNewAlert.less';

const cookieStorage = new CookieStorage();

const WhatsNewAlert = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { isFirstTimeUser } = useAuth();
  const { appVersion } = useApplicationStore();
  const [showWhatsNew, setShowWhatsNew] = useState({
    alert: false,
    modal: false,
  });
  const cookieKey = getVersionedStorageKey(VERSION);

  const { releaseLink, blogLink, isMajorRelease } = useMemo(() => {
    return {
      // If the version ends with .0, it is a major release
      isMajorRelease: appVersion?.endsWith('.0'),
      releaseLink: brandClassBase.getReleaseLink(appVersion ?? ''),
      blogLink: brandClassBase.getBlogLink(appVersion ?? ''),
    };
  }, [appVersion]);

  const isHomePage = useMemo(
    () => location.pathname.includes(ROUTES.MY_DATA),
    [location.pathname]
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
    cookieStorage.setItem(cookieKey, 'true', {
      expires: getReleaseVersionExpiry(),
    });
    onModalCancel();
  }, [cookieStorage, onModalCancel, getReleaseVersionExpiry]);

  useEffect(() => {
    setShowWhatsNew({
      alert: cookieStorage.getItem(cookieKey) !== 'true',
      modal: false,
    });
  }, [isFirstTimeUser]);

  return (
    <>
      {showWhatsNew.alert && isHomePage && (
        <Affix
          style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 2000 }}>
          <Card bodyStyle={{ padding: 0 }} className="whats-new-alert-card">
            <Row
              gutter={0}
              style={{ minHeight: 140, position: 'relative' }}
              wrap={false}>
              <Col className="whats-new-alert-left" flex="160px">
                <RocketIcon
                  style={{ width: 48, height: 48, marginBottom: 12 }}
                />
                <Typography.Title
                  className="text-md text-white"
                  level={5}
                  style={{ marginBottom: 8 }}>
                  {t('label.version-number', { version: appVersion ?? '' })}
                </Typography.Title>
              </Col>
              <Col
                flex="auto"
                style={{
                  padding: '24px 32px 24px 24px',
                  position: 'relative',
                }}>
                <Typography.Title
                  className="text-sm"
                  level={5}
                  style={{ marginBottom: 8 }}>
                  {t('label.new-update-announcement')}
                </Typography.Title>
                <div className="whats-new-alert-links">
                  <Button
                    href={releaseLink}
                    rel="noopener noreferrer"
                    style={{ padding: 0, fontWeight: 600, color: '#2563eb' }}
                    target="_blank"
                    type="link">
                    {t('label.release-notes')}
                  </Button>
                  {/* Only show the blog link for major releases */}
                  {isMajorRelease && (
                    <Button
                      href={blogLink}
                      rel="noopener noreferrer"
                      style={{ padding: 0, fontWeight: 600, color: '#2563eb' }}
                      target="_blank"
                      type="link">
                      {t('label.blog')}
                    </Button>
                  )}
                </div>
              </Col>
              <Col flex={24}>
                <Button
                  aria-label={t('label.close')}
                  className="whats-new-alert-close float-right"
                  icon={<CloseIcon color="#888" height={20} width={20} />}
                  type="text"
                  onClick={handleCancel}
                />
              </Col>
            </Row>
          </Card>
        </Affix>
      )}
    </>
  );
};

export default WhatsNewAlert;
