/*
 *  Copyright 2021 Collate
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

import { AxiosResponse } from 'axios';
import { CookieStorage } from 'cookie-storage';
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import { Match } from 'Models';
import React, { useEffect, useState } from 'react';
import {
  NavLink,
  useHistory,
  useLocation,
  useRouteMatch,
} from 'react-router-dom';
import appState from '../../AppState';
import { getVersion } from '../../axiosAPIs/miscAPI';
import {
  getExplorePathWithSearch,
  // navLinkDevelop,
  navLinkSettings,
  ROUTES,
} from '../../constants/constants';
import { urlGitbookDocs, urlJoinSlack } from '../../constants/url.const';
import { useAuth } from '../../hooks/authHooks';
import { userSignOut } from '../../utils/AuthUtils';
import { addToRecentSearched } from '../../utils/CommonUtils';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import { activeLink, normalLink } from '../../utils/styleconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import DropDown from '../dropdown/DropDown';
import { WhatsNewModal } from '../Modals/WhatsNewModal';
import { COOKIE_VERSION } from '../Modals/WhatsNewModal/whatsNewData';
// import Tour from '../tour/Tour';
import { ReactComponent as IconDefaultUserProfile } from './../../assets/svg/ic-default-profile.svg';
import SearchOptions from './SearchOptions';
import Suggestions from './Suggestions';

const cookieStorage = new CookieStorage();

const Appbar: React.FC = (): JSX.Element => {
  const location = useLocation();
  const history = useHistory();
  const { isAuthenticatedRoute, isSignedIn, isFirstTimeUser, isAuthDisabled } =
    useAuth(location.pathname);
  const match: Match | null = useRouteMatch({
    path: ROUTES.EXPLORE_WITH_SEARCH,
  });
  const searchQuery = match?.params?.searchQuery;
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState<boolean>(false);
  const [searchIcon, setSearchIcon] = useState<string>('icon-searchv1');

  const [version, setVersion] = useState<string>('');

  const navStyle = (value: boolean) => {
    if (value) return { color: activeLink };

    return { color: normalLink };
  };

  const openModal = () => {
    setIsFeatureModalOpen(true);
  };

  const supportLinks = [
    {
      name: (
        <span>
          <SVGIcons
            alt="API icon"
            className="tw-align-middle tw--mt-0.5 tw-mr-0.5"
            icon={Icons.VERSION_BLACK}
            width="12"
          />{' '}
          <span className="tw-text-grey-muted">{`Version ${
            (version ? version : '?').split('-')[0]
          }`}</span>
        </span>
      ),
      to: '',
      disabled: false,
      icon: <></>,
      isText: true,
    },
    {
      name: `Docs`,
      to: urlGitbookDocs,
      isOpenNewTab: true,
      disabled: false,
      icon: (
        <SVGIcons
          alt="Doc icon"
          className="tw-align-middle tw--mt-0.5 tw-mr-0.5"
          icon={Icons.DOC}
          width="12"
        />
      ),
    },
    {
      name: `API`,
      to: ROUTES.SWAGGER,
      disabled: false,
      icon: (
        <SVGIcons
          alt="API icon"
          className="tw-align-middle tw--mt-0.5 tw-mr-0.5"
          icon={Icons.API}
          width="12"
        />
      ),
    },
    {
      name: `Slack`,
      to: urlJoinSlack,
      disabled: false,
      isOpenNewTab: true,
      icon: (
        <SVGIcons
          alt="slack icon"
          className="tw-align-middle tw-mr-0.5"
          icon={Icons.SLACK_GREY}
          width="12"
        />
      ),
    },
  ];

  const getUserDisplayName = () => {
    const name = isAuthDisabled
      ? appState.users?.length > 0
        ? appState.users[0].displayName
        : 'User'
      : appState.userDetails.displayName || appState.userDetails.name;

    return (
      <span data-testid="greeting-text">
        <span className="tw-font-medium">{name}</span>
      </span>
    );
  };

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setIsFeatureModalOpen(
      // TODO: Add !isFirstTimeUser to condition if showing Welcome Modal
      cookieStorage.getItem(COOKIE_VERSION) !== 'true'
    );
  }, [isFirstTimeUser]);

  useEffect(() => {
    if (isAuthDisabled) {
      getVersion().then((res: AxiosResponse) => {
        setVersion(res.data.version);
      });
    } else {
      if (!isEmpty(appState.userDetails)) {
        getVersion().then((res: AxiosResponse) => {
          setVersion(res.data.version);
        });
      }
    }
  }, [appState.userDetails, isAuthDisabled]);

  return (
    <>
      {isAuthenticatedRoute && isSignedIn ? (
        <div className="tw-h-16 tw-py-3 tw-px-5 tw-border-b-2 tw-border-separator">
          <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap">
            <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap">
              <NavLink id="openmetadata_logo" to="/">
                <SVGIcons
                  alt="OpenMetadata Logo"
                  icon={Icons.LOGO}
                  width="90"
                />
              </NavLink>
              <div className="tw-ml-5">
                <NavLink
                  className="tw-nav focus:tw-no-underline"
                  data-testid="appbar-item"
                  id="explore"
                  style={navStyle(location.pathname.startsWith('/explore'))}
                  to={{
                    pathname: '/explore',
                  }}>
                  Explore
                </NavLink>
                <DropDown
                  dropDownList={navLinkSettings}
                  label="Settings"
                  type="link"
                />
              </div>
            </div>
            <div
              className="tw-flex-none tw-relative tw-justify-items-center tw-ml-auto"
              data-testid="appbar-item">
              <SVGIcons
                alt="icon-search"
                className="tw-absolute tw-block tw-z-10 tw-w-4 tw-h-4 tw-right-2.5 tw-top-2.5 tw-leading-8 tw-text-center tw-pointer-events-none"
                icon={searchIcon}
              />
              <input
                autoComplete="off"
                className="tw-relative search-grey tw-rounded tw-border tw-border-main focus:tw-outline-none tw-pl-2 tw-pt-2 tw-pb-1.5 tw-form-inputs"
                data-testid="searchBox"
                id="searchBox"
                placeholder="Search for Table, Topics, Dashboards and Pipeline"
                type="text"
                value={searchValue || ''}
                onBlur={() => setSearchIcon('icon-searchv1')}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                }}
                onFocus={() => setSearchIcon('icon-searchv1color')}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  const target = e.target as HTMLInputElement;
                  if (e.key === 'Enter') {
                    setIsOpen(false);
                    addToRecentSearched(target.value);
                    history.push(
                      getExplorePathWithSearch(
                        target.value,
                        // this is for if user is searching from another page
                        location.pathname.startsWith(ROUTES.EXPLORE)
                          ? appState.explorePageTab
                          : 'tables'
                      )
                    );
                  }
                }}
              />
              {searchValue &&
                (isInPageSearchAllowed(location.pathname) ? (
                  <SearchOptions
                    isOpen={isOpen}
                    options={inPageSearchOptions(location.pathname)}
                    searchText={searchValue}
                    selectOption={(text) => {
                      appState.inPageSearchText = text;
                    }}
                    setIsOpen={setIsOpen}
                  />
                ) : (
                  <Suggestions
                    isOpen={isOpen}
                    searchText={searchValue}
                    setIsOpen={setIsOpen}
                  />
                ))}
            </div>
            <div className="tw-flex tw-ml-auto tw-pl-36">
              <button
                className="tw-nav focus:tw-no-underline hover:tw-underline"
                data-testid="whatsnew-modal"
                onClick={openModal}>
                <SVGIcons
                  alt="Doc icon"
                  className="tw-align-middle tw-mr-1"
                  icon={Icons.WHATS_NEW}
                  width="16"
                />
                {/* <span>What&#39;s new</span> */}
              </button>
              {/* <NavLink
              className="tw-nav focus:tw-no-underline hover:tw-underline"
              data-testid="tour"
              style={navStyle(location.pathname.startsWith('/explore'))}
              to={{
                pathname: '/tour',
              }}>
              <SVGIcons
                alt="Doc icon"
                className="tw-align-middle tw--mt-0.5 tw-mr-1"
                icon={Icons.WHATS_NEW}
                width="16"
              />
              <span>Tour</span>
            </NavLink> */}
              <div>
                <DropDown
                  dropDownList={supportLinks}
                  icon={
                    <SVGIcons
                      alt="Doc icon"
                      className="tw-align-middle tw-mt-0.5 tw-mr-1"
                      icon={Icons.HELP_CIRCLE}
                      width="16"
                    />
                  }
                  isDropDownIconVisible={false}
                  isLableVisible={false}
                  label="Need Help"
                  type="link"
                />
              </div>
            </div>
            <div data-testid="dropdown-profile">
              <DropDown
                dropDownList={[
                  {
                    name: getUserDisplayName(),
                    to: '',
                    disabled: false,
                    icon: <></>,
                    isText: true,
                  },
                  {
                    name: 'Logout',
                    to: '#/action-1',
                    disabled: false,
                    method: userSignOut,
                  },
                ]}
                icon={
                  <>
                    {appState?.userDetails?.profile?.images?.image512 ? (
                      <div className="profile-image tw-mr-1">
                        <img
                          alt="user"
                          src={appState.userDetails.profile.images.image512}
                        />
                      </div>
                    ) : (
                      <IconDefaultUserProfile
                        className="tw-mr-1"
                        style={{
                          height: '22px',
                          width: '22px',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </>
                }
                isDropDownIconVisible={false}
                type="link"
              />
            </div>
          </div>
          {isFeatureModalOpen && (
            <WhatsNewModal
              header="What’s new!"
              onCancel={() => setIsFeatureModalOpen(false)}
            />
          )}
        </div>
      ) : null}
      {/* <Tour /> */}
    </>
  );
};

export default observer(Appbar);
