/*
 *  Copyright 2022 Collate.
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

import { Space } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isString } from 'lodash';
import { observer } from 'mobx-react';
import Qs from 'qs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import appState from '../../AppState';
import { ReactComponent as IconAPI } from '../../assets/svg/api.svg';
import { ReactComponent as IconDoc } from '../../assets/svg/doc.svg';
import { ReactComponent as IconExternalLink } from '../../assets/svg/external-links.svg';
import { ReactComponent as IconSlackGrey } from '../../assets/svg/slack-grey.svg';
import { ReactComponent as IconVersionBlack } from '../../assets/svg/version-black.svg';
import { useGlobalSearchProvider } from '../../components/GlobalSearchProvider/GlobalSearchProvider';
import { useTourProvider } from '../../components/TourProvider/TourProvider';
import {
  getExplorePath,
  ROUTES,
  TOUR_SEARCH_TERM,
} from '../../constants/constants';
import { tabsInfo } from '../../constants/explore.constants';
import {
  urlGitbookDocs,
  urlGithubRepo,
  urlJoinSlack,
} from '../../constants/URL.constants';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { getVersion } from '../../rest/miscAPI';
import {
  extractDetailsFromToken,
  isProtectedRoute,
  isTourRoute,
} from '../../utils/AuthProvider.util';
import { addToRecentSearched } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import NavBar from '../nav-bar/NavBar';
import './app-bar.style.less';

const Appbar: React.FC = (): JSX.Element => {
  const location = useLocation();
  const history = useHistory();
  const { t } = useTranslation();
  const { isTourOpen, updateTourPage, updateTourSearch, tourSearchValue } =
    useTourProvider();

  const { isAuthDisabled, isAuthenticated, onLogoutHandler } = useAuthContext();

  const { searchCriteria } = useGlobalSearchProvider();

  const parsedQueryString = Qs.parse(
    location.search.startsWith('?')
      ? location.search.substr(1)
      : location.search
  );

  const searchQuery = isString(parsedQueryString.search)
    ? parsedQueryString.search
    : '';

  const [searchValue, setSearchValue] = useState(searchQuery);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState<boolean>(false);
  const [version, setVersion] = useState<string>('');

  const handleFeatureModal = (value: boolean) => {
    setIsFeatureModalOpen(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (isTourOpen) {
      updateTourSearch(value);
    } else {
      value ? setIsOpen(true) : setIsOpen(false);
    }
  };

  const supportLink = [
    {
      label: (
        <Space
          className="cursor-pointer w-full"
          size={4}
          onClick={() => history.push(ROUTES.TOUR)}>
          <SVGIcons
            alt="tour-con"
            className="align-middle m-r-xss"
            icon={Icons.TOUR}
            width="12"
          />
          <span className="text-base-color">{t('label.tour')}</span>
        </Space>
      ),
      key: 'tour',
    },
    {
      label: (
        <a
          className="link-title"
          href={urlGitbookDocs}
          rel="noreferrer"
          target="_blank">
          <Space size={4}>
            <IconDoc
              className="align-middle"
              height={14}
              name="Doc icon"
              width={14}
            />
            <span className="text-base-color">{t('label.doc-plural')}</span>

            <IconExternalLink
              className="text-base-color m-l-xss"
              height={14}
              width={14}
            />
          </Space>
        </a>
      ),
      key: 'docs',
    },
    {
      label: (
        <Link className="link-title" to={ROUTES.SWAGGER}>
          <Space size={4}>
            <IconAPI
              className="align-middle"
              height={14}
              name="API icon"
              width={14}
            />
            <span className="text-base-color">{t('label.api-uppercase')}</span>
          </Space>
        </Link>
      ),
      key: 'api',
    },
    {
      label: (
        <a
          className="link-title"
          href={urlJoinSlack}
          rel="noreferrer"
          target="_blank">
          <Space size={4}>
            <IconSlackGrey
              className="align-middle"
              height={14}
              name="slack icon"
              width={14}
            />
            <span className="text-base-color">{t('label.slack-support')}</span>
            <IconExternalLink
              className="text-base-color m-l-xss"
              height={14}
              width={14}
            />
          </Space>
        </a>
      ),
      key: 'slack',
    },

    {
      label: (
        <Space
          className="cursor-pointer w-full"
          size={4}
          onClick={() => handleFeatureModal(true)}>
          <SVGIcons
            alt="Doc icon"
            className="align-middle m-r-xss"
            icon={Icons.WHATS_NEW}
            width="14"
          />
          <span className="text-base-color">{t('label.whats-new')}</span>
        </Space>
      ),
      key: 'whats-new',
    },
    {
      label: (
        <a
          className="link-title"
          href={urlGithubRepo}
          rel="noreferrer"
          target="_blank">
          <Space size={4}>
            <IconVersionBlack
              className="align-middle"
              height={14}
              name="Version icon"
              width={14}
            />

            <span className="text-base-color hover:text-primary">{`${t(
              'label.version'
            )} ${(version ? version : '?').split('-')[0]}`}</span>

            <IconExternalLink
              className="text-base-color m-l-xss"
              height={14}
              width={14}
            />
          </Space>
        </a>
      ),
      key: 'versions',
    },
  ];

  const searchHandler = (value: string) => {
    if (!isTourOpen) {
      setIsOpen(false);
      addToRecentSearched(value);

      const defaultTab: string =
        searchCriteria !== '' ? tabsInfo[searchCriteria].path : '';

      history.push(
        getExplorePath({
          tab: defaultTab,
          search: value,
          isPersistFilters: false,
        })
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      if (isTourOpen && searchValue === TOUR_SEARCH_TERM) {
        updateTourPage(CurrentTourPageType.EXPLORE_PAGE);
        updateTourSearch('');
      }

      searchHandler(target.value);
    }
  };

  const handleOnclick = () => {
    searchHandler(searchValue);
  };

  const handleClear = () => {
    setSearchValue('');
    searchHandler('');
  };

  const fetchOMVersion = () => {
    getVersion()
      .then((res) => {
        setVersion(res.version);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.version'),
          })
        );
      });
  };

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);
  useEffect(() => {
    if (isTourOpen) {
      setSearchValue(tourSearchValue);
    }
  }, [tourSearchValue, isTourOpen]);

  useEffect(() => {
    if (isAuthDisabled) {
      fetchOMVersion();
    } else {
      if (!isEmpty(appState.userDetails)) {
        fetchOMVersion();
      }
    }
  }, [appState.userDetails, isAuthDisabled]);

  useEffect(() => {
    const handleDocumentVisibilityChange = () => {
      if (
        isProtectedRoute(location.pathname) &&
        isTourRoute(location.pathname)
      ) {
        return;
      }
      const { isExpired, exp } = extractDetailsFromToken();
      if (!document.hidden && isExpired) {
        exp && toast.info(t('message.session-expired'));
        onLogoutHandler();
      }
    };

    addEventListener('focus', handleDocumentVisibilityChange);

    return () => {
      removeEventListener('focus', handleDocumentVisibilityChange);
    };
  }, []);

  return (
    <>
      {isProtectedRoute(location.pathname) &&
      (isAuthDisabled || isAuthenticated) ? (
        <NavBar
          handleClear={handleClear}
          handleFeatureModal={handleFeatureModal}
          handleKeyDown={handleKeyDown}
          handleOnClick={handleOnclick}
          handleSearchBoxOpen={setIsOpen}
          handleSearchChange={handleSearchChange}
          isFeatureModalOpen={isFeatureModalOpen}
          isSearchBoxOpen={isOpen}
          pathname={location.pathname}
          searchValue={searchValue || ''}
          supportDropdown={supportLink}
        />
      ) : null}
    </>
  );
};

export default observer(Appbar);
