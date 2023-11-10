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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg';
import {
  BLACK_COLOR,
  ROUTES,
  STAR_OMD_USER,
} from '../../../constants/constants';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getReleaseVersionExpiry } from '../WhatsNewModal/WhatsNewModal.util';

const cookieStorage = new CookieStorage();

const GithubStarModal = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const [showGithubStarPopup, setShowGithubStarPopup] = useState(false);

  const loggedInUserName = useMemo(() => currentUser?.name, [currentUser]);

  const userCookieName = useMemo(
    () => `${STAR_OMD_USER}_${loggedInUserName}`,
    [loggedInUserName]
  );

  const isHomePage = useMemo(
    () => location.pathname.includes(ROUTES.MY_DATA),
    [location.pathname]
  );

  const usernameExistsInCookie = useMemo(
    () => Boolean(cookieStorage.getItem(userCookieName)),
    [userCookieName, loggedInUserName]
  );

  const updateGithubPopup = useCallback(
    (show: boolean) => {
      if (loggedInUserName && show) {
        cookieStorage.setItem(userCookieName, 'true', {
          expires: getReleaseVersionExpiry(),
        });
      }
      setShowGithubStarPopup(show);
    },
    [
      loggedInUserName,
      usernameExistsInCookie,
      userCookieName,
      getReleaseVersionExpiry,
    ]
  );

  useEffect(() => {
    updateGithubPopup(!usernameExistsInCookie);

    return () => setShowGithubStarPopup(false);
  }, [usernameExistsInCookie, updateGithubPopup]);

  return (
    <>
      {showGithubStarPopup && isHomePage && (
        <Affix className="whats-new-alert-container">
          <Card className="cursor-pointer" data-testid="whats-new-alert-card">
            <Space align="start" className="d-flex justify-between">
              <Typography.Text className="whats-new-alert-header">
                {t('label.open-metadata-updated')}
              </Typography.Text>
              <Button
                className="flex-center m--t-xss"
                data-testid="close-whats-new-alert"
                icon={<CloseIcon color={BLACK_COLOR} height={12} width={12} />}
                type="text"
                onClick={() => setShowGithubStarPopup(false)}
              />
            </Space>

            <Typography.Text>{t('label.star-github')}</Typography.Text>
          </Card>
        </Affix>
      )}
    </>
  );
};

export default GithubStarModal;
