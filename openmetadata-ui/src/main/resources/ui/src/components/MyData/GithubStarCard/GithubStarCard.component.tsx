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
import {
  Box,
  Button,
  Card,
  CloseButton,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StarGithubIcon } from '../../../assets/svg/ic-star-github.svg';
import { ReactComponent as StarIcon } from '../../../assets/svg/ic-start-filled-github.svg';
import {
  STAR_OMD_USER,
  TWO_MINUTE_IN_MILLISECOND,
  VERSION,
} from '../../../constants/constants';
import { OMD_REPOSITORY_LINK } from '../../../constants/docs.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { getRepositoryData } from '../../../rest/commonAPI';
import { isLandingPagePath } from '../../../utils/RouterUtils';
import { getVersionedStorageKey } from '../../../utils/Version/Version';
import { getReleaseVersionExpiry } from '../../../utils/WhatsNewModal.util';
import './github-star-card.style.less';

const cookieStorage = new CookieStorage();

const GithubStarCard = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { currentUser, appVersion } = useApplicationStore();
  const [showGithubStarPopup, setShowGithubStarPopup] = useState(false);
  const [starredCount, setStarredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isWhatNewAlertVisible = useMemo(
    () =>
      cookieStorage.getItem(getVersionedStorageKey(VERSION, appVersion)) !==
      'true',
    [cookieStorage, appVersion]
  );

  const userCookieName = useMemo(
    () => `${STAR_OMD_USER}_${currentUser?.name}`,
    [currentUser?.name]
  );

  const isHomePage = useMemo(
    () => isLandingPagePath(location.pathname),
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
    <Box
      className={classNames(
        'tw:fixed tw:right-7.5 tw:-bottom-full tw:z-1 tw:w-full tw:max-w-90 tw:border-none',
        isWhatNewAlertVisible
          ? 'github-star-popup-card-with-alert'
          : 'github-star-popup-card-without-alert'
      )}>
      <Card data-testid="github-star-popup-card">
        <Card.Content>
          <Box align="center" gap={2} justify="between">
            <Box inline align="center" gap={2}>
              <StarIcon className="github-star-icon" />

              <Typography className="github-star-popup-header">
                {t('label.star-us-on-github')}
              </Typography>
            </Box>
            <CloseButton
              className="tw:-mt-1 tw:text-primary"
              data-testid="close-github-star-popup-card"
              size="sm"
              onPress={handleClosePopup}
            />
          </Box>

          <Typography as="p" className="github-star-popup-description">
            {t('message.star-on-github-description')}
          </Typography>

          <Box className="tw:mt-4" gap={0}>
            <Button
              className="tw:rounded-r-none tw:bg-secondary"
              color="secondary"
              href={OMD_REPOSITORY_LINK}
              iconLeading={<Icon component={StarGithubIcon} size={12} />}
              rel="noopener noreferrer"
              target="_blank">
              {t('label.star')}
            </Button>
            <Button
              className="tw:-ml-px tw:rounded-l-none"
              color="secondary"
              href={OMD_REPOSITORY_LINK}
              rel="noopener noreferrer"
              target="_blank">
              {isLoading ? (
                <div data-testid="skeleton-loader">
                  <Skeleton height={36} variant="rounded" width={72} />
                </div>
              ) : (
                starredCount
              )}
            </Button>
          </Box>
        </Card.Content>
      </Card>
    </Box>
  ) : null;
};

export default GithubStarCard;
