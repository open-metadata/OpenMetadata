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
import Icon from '@ant-design/icons';
import { Box, Typography } from '@openmetadata/ui-core-components';
import { Affix, Button, Card } from 'antd';
import { CookieStorage } from 'cookie-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { VERSION } from '../../../../constants/constants';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import { isLandingPagePath } from '../../../../utils/RouterUtils';
import {
  getSimplifiedVersion,
  getVersionedStorageKey,
  getVersionReleaseTimestamp,
} from '../../../../utils/Version/Version';
import { getReleaseVersionExpiry } from '../../../../utils/WhatsNewModal.util';
import './WhatsNewAlert.less';

const cookieStorage = new CookieStorage();

const WhatsNewAlert = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { appVersion } = useApplicationStore();
  const [showWhatsNew, setShowWhatsNew] = useState({
    alert: false,
    modal: false,
  });
  const cookieKey = useMemo(() => {
    return appVersion ? getVersionedStorageKey(VERSION, appVersion) : null;
  }, [appVersion]);

  const {
    releaseLink,
    blogLink,
    isMajorRelease,
    simplifiedVersion,
    releaseDate,
  } = useMemo(() => {
    const releaseTimestamp = getVersionReleaseTimestamp(appVersion);

    return {
      // If the version ends with .0, it is a major release
      isMajorRelease: appVersion?.endsWith('.0'),
      releaseLink: brandClassBase.getReleaseLink(appVersion ?? ''),
      blogLink: brandClassBase.getBlogLink(appVersion ?? ''),
      simplifiedVersion: getSimplifiedVersion(appVersion),
      releaseDate: releaseTimestamp
        ? formatDateTimeLong(releaseTimestamp, 'dd MMM yyyy')
        : undefined,
    };
  }, [appVersion]);

  const isHomePage = useMemo(
    () => isLandingPagePath(location.pathname),
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
    if (cookieKey) {
      cookieStorage.setItem(cookieKey, 'true', {
        expires: getReleaseVersionExpiry(),
      });
    }
    onModalCancel();
  }, [cookieStorage, onModalCancel, getReleaseVersionExpiry, cookieKey]);

  useEffect(() => {
    if (cookieKey) {
      setShowWhatsNew((prev) => ({
        ...prev,
        alert: cookieStorage.getItem(cookieKey) !== 'true',
      }));
    }
  }, [cookieKey]);

  return (
    <>
      {showWhatsNew.alert && isHomePage && (
        <Affix className="whats-new-alert-affix">
          <Card
            className="whats-new-alert-card"
            data-testid="whats-new-alert-card">
            <Box className="layout-row" wrap="nowrap">
              <Box
                className={`layout-column tw:block whats-new-alert-left${
                  releaseDate ? '' : ' whats-new-alert-left--centered'
                }`}
                style={{ flex: '0 0 220px' }}>
                <div className="whats-new-alert-version-block">
                  <div className="whats-new-alert-meta">
                    <Typography className="whats-new-alert-meta-label">
                      {t('label.version')}
                    </Typography>
                    <Typography className="whats-new-alert-version">
                      {simplifiedVersion}
                    </Typography>
                  </div>
                  {releaseDate && (
                    <>
                      <div className="whats-new-alert-divider" />
                      <div className="whats-new-alert-meta">
                        <Typography className="whats-new-alert-meta-label">
                          {t('label.released')}
                        </Typography>
                        <Typography className="whats-new-alert-released-date">
                          {releaseDate}
                        </Typography>
                      </div>
                    </>
                  )}
                </div>
              </Box>
              <Box
                className="layout-column tw:block whats-new-alert-right"
                style={{ flex: 'auto' }}>
                <Typography className="text-md font-semibold">
                  {t('label.new-update-announcement')}
                </Typography>
                <Typography
                  as="p"
                  className="whats-new-alert-subtext tw:mb-3.5!">
                  {t('label.to-learn-more-please-check-out')}
                </Typography>
                <div className="whats-new-alert-links">
                  <Button
                    className="p-0"
                    href={releaseLink}
                    rel="noopener noreferrer"
                    target="_blank"
                    type="link">
                    {t('label.release-notes')}
                  </Button>
                  {/* Only show the blog link for major releases */}
                  {isMajorRelease && (
                    <Button
                      className="p-0"
                      href={blogLink}
                      rel="noopener noreferrer"
                      target="_blank"
                      type="link">
                      {t('label.blog')}
                    </Button>
                  )}
                </div>
              </Box>
              <Box
                className="layout-column tw:block"
                style={{ flex: '0 0 48px' }}>
                <Icon
                  className="whats-new-alert-close"
                  component={CloseIcon}
                  onClick={handleCancel}
                />
              </Box>
            </Box>
          </Card>
        </Affix>
      )}
    </>
  );
};

export default WhatsNewAlert;
