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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Affix, Button, Card, Skeleton, Space, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { CookieStorage } from 'cookie-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg';
import { ReactComponent as StarGithubIcon } from '../../../assets/svg/ic-star-github.svg';
import { ReactComponent as StarIcon } from '../../../assets/svg/ic-start-filled-github.svg';
import {
  BLACK_COLOR,
  ROUTES,
  STAR_OMD_USER,
  TWO_MINUTE_IN_MILLISECOND,
  VERSION,
} from '../../../constants/constants';
import { OMD_REPOSITORY_LINK } from '../../../constants/docs.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { getRepositoryData } from '../../../rest/commonAPI';
import { getVersionedStorageKey } from '../../../utils/Version/version';
import { getReleaseVersionExpiry } from '../../../utils/WhatsNewModal.util';
import './github-star-card.style.less';

const cookieStorage = new CookieStorage();

const GithubStarCard = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { currentUser } = useApplicationStore();
  const [showGithubStarPopup, setShowGithubStarPopup] = useState(false);
  const [starredCount, setStarredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isWhatNewAlertVisible = useMemo(
    () => cookieStorage.getItem(getVersionedStorageKey(VERSION)) !== 'true',
    [cookieStorage]
  );

  const userCookieName = useMemo(
    () => `${STAR_OMD_USER}_${currentUser?.name}`,
    [currentUser?.name]
  );

  const isHomePage = useMemo(
    () => location.pathname.includes(ROUTES.MY_DATA),
    [location.pathname]
  );

  const usernameExistsInCookie = useMemo(
    () => Boolean(cookieStorage.getItem(userCookieName)),
    [userCookieName]
  );

  const fetchOpenMetaData = async () => {
    try {
      const res = await getRepositoryData();
      setStarredCount(res.stargazers_count);
    } catch (err) {
      // Error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = useCallback(() => {
    setShowGithubStarPopup(false);
  }, []);

  const handleClosePopup = useCallback(() => {
    cookieStorage.setItem(userCookieName, 'true', {
      expires: getReleaseVersionExpiry(),
    });
    handleCancel();
  }, [userCookieName, handleCancel]);

  const githubPopup = useCallback(
    (show: boolean) => {
      if (currentUser?.name && show) {
        fetchOpenMetaData();
      }
      setShowGithubStarPopup(show);
    },
    [currentUser?.name, userCookieName]
  );

  const updateGithubPopup = useCallback(
    (show: boolean) => {
      if (isWhatNewAlertVisible) {
        setTimeout(() => {
          githubPopup(show);
        }, TWO_MINUTE_IN_MILLISECOND);
      } else {
        githubPopup(show);
      }
    },
    [isWhatNewAlertVisible, githubPopup]
  );

  useEffect(() => {
    updateGithubPopup(!usernameExistsInCookie);

    return () => setShowGithubStarPopup(false);
  }, [usernameExistsInCookie, updateGithubPopup]);

  return showGithubStarPopup && isHomePage ? (
    <Affix
      className={`github-star-popup-card 
      ${
        isWhatNewAlertVisible
          ? 'github-star-popup-card-with-alert'
          : 'github-star-popup-card-without-alert'
      }
      `}>
      <Card data-testid="github-star-popup-card">
        <Space align="center" className="d-flex justify-between">
          <Space>
            <StarIcon className="github-star-icon" />

            <Typography.Text className="github-star-popup-header">
              {t('label.star-us-on-github')}
            </Typography.Text>
          </Space>
          <Button
            className="flex-center m--t-xss"
            data-testid="close-github-star-popup-card"
            icon={<CloseIcon color={BLACK_COLOR} height={12} width={12} />}
            type="text"
            onClick={handleClosePopup}
          />
        </Space>

        <Typography.Paragraph className="github-star-popup-description">
          {t('message.star-on-github-description')}
        </Typography.Paragraph>

        <ButtonGroup className="github-action-button-group">
          <Link
            target="_blank"
            to={{
              pathname: OMD_REPOSITORY_LINK,
            }}>
            <Button
              className="github-star-button github-modal-action-button"
              icon={<Icon component={StarGithubIcon} size={12} />}>
              {t('label.star')}
            </Button>
          </Link>

          <Link
            target="_blank"
            to={{
              pathname: OMD_REPOSITORY_LINK,
            }}>
            <Button className="github-modal-action-button">
              {isLoading ? (
                <div data-testid="skeleton-loader">
                  <Skeleton.Button active size="small" />
                </div>
              ) : (
                starredCount
              )}
            </Button>
          </Link>
        </ButtonGroup>
      </Card>
    </Affix>
  ) : null;
};

export default GithubStarCard;
