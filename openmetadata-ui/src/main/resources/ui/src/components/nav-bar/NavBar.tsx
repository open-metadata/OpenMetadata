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

import {
  Badge,
  Dropdown,
  Image,
  Input,
  InputRef,
  Select,
  Space,
  Tooltip,
} from 'antd';
import { useApplicationConfigProvider } from 'components/ApplicationConfigProvider/ApplicationConfigProvider';
import { CookieStorage } from 'cookie-storage';
import i18next from 'i18next';
import { debounce, toString } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useHistory } from 'react-router-dom';
import { refreshPage } from 'utils/CommonUtils';
import { isCommandKeyPress, Keys } from 'utils/KeyboardUtil';
import AppState from '../../AppState';
import Logo from '../../assets/svg/logo-monogram.svg';
import {
  globalSearchOptions,
  NOTIFICATION_READ_TIMER,
  ROUTES,
  SOCKET_EVENTS,
} from '../../constants/constants';
import {
  hasNotificationPermission,
  shouldRequestPermission,
} from '../../utils/BrowserNotificationUtils';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../utils/FeedUtils';
import {
  languageSelectOptions,
  SupportedLocales,
} from '../../utils/i18next/i18nextUtil';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import { activeLink, normalLink } from '../../utils/styleconstant';
import { dropdownIcon as DropDownIcon } from '../../utils/svgconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { getTaskDetailPath } from '../../utils/TasksUtils';
import SearchOptions from '../app-bar/SearchOptions';
import Suggestions from '../app-bar/Suggestions';
import Avatar from '../common/avatar/Avatar';
import CmdKIcon from '../common/CmdKIcon/CmdKIcon.component';
import LegacyDropDown from '../dropdown/DropDown';
import { WhatsNewModal } from '../Modals/WhatsNewModal';
import NotificationBox from '../NotificationBox/NotificationBox.component';
import { useWebSocketConnector } from '../web-scoket/web-scoket.provider';
import { NavBarProps } from './NavBar.interface';

const cookieStorage = new CookieStorage();

const NavBar = ({
  supportDropdown,
  profileDropdown,
  searchValue,
  searchCriteria,
  isFeatureModalOpen,
  isTourRoute = false,
  pathname,
  username,
  isSearchBoxOpen,
  handleSearchBoxOpen,
  handleFeatureModal,
  handleSearchChange,
  handleSearchCriteriaChange,
  handleKeyDown,
  handleOnClick,
  handleClear,
}: NavBarProps) => {
  const { logoConfig } = useApplicationConfigProvider();

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );
  const history = useHistory();
  const { t } = useTranslation();
  const { Option } = Select;
  const searchRef = useRef<InputRef>(null);
  const [searchIcon, setSearchIcon] = useState<string>('icon-searchv1');
  const [cancelIcon, setCancelIcon] = useState<string>('close-circle-outlined');
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const [hasTaskNotification, setHasTaskNotification] =
    useState<boolean>(false);
  const [hasMentionNotification, setHasMentionNotification] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('Task');
  const [isImgUrlValid, setIsImgUrlValid] = useState<boolean>(true);

  const entitiesSelect = useMemo(
    () => (
      <Select
        defaultActiveFirstOption
        className="global-search-select"
        listHeight={300}
        popupClassName="global-search-select-menu"
        value={searchCriteria}
        onChange={handleSearchCriteriaChange}>
        {globalSearchOptions.map(({ value, label }) => (
          <Option key={value} value={value}>
            {label}
          </Option>
        ))}
      </Select>
    ),
    [searchCriteria, globalSearchOptions]
  );

  const profilePicture = useMemo(
    () => currentUser?.profile?.images?.image512,
    [currentUser]
  );

  const [language, setLanguage] = useState(
    cookieStorage.getItem('i18next') || SupportedLocales.English
  );

  const { socket } = useWebSocketConnector();

  const navStyle = (value: boolean) => {
    if (value) {
      return { color: activeLink };
    }

    return { color: normalLink };
  };

  const debouncedOnChange = useCallback(
    (text: string): void => {
      setSuggestionSearch(text);
    },
    [setSuggestionSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  const handleTaskNotificationRead = () => {
    setHasTaskNotification(false);
  };

  const handleMentionsNotificationRead = () => {
    setHasMentionNotification(false);
  };

  const handleBellClick = useCallback(
    (visible: boolean) => {
      if (visible) {
        switch (activeTab) {
          case 'Task':
            hasTaskNotification &&
              setTimeout(() => {
                handleTaskNotificationRead();
              }, NOTIFICATION_READ_TIMER);

            break;

          case 'Conversation':
            hasMentionNotification &&
              setTimeout(() => {
                handleMentionsNotificationRead();
              }, NOTIFICATION_READ_TIMER);

            break;
        }
      }
    },
    [hasTaskNotification]
  );

  const handleActiveTab = (key: string) => {
    setActiveTab(key);
  };

  const showBrowserNotification = (
    about: string,
    createdBy: string,
    type: string,
    id?: string
  ) => {
    if (!hasNotificationPermission()) {
      return;
    }
    const entityType = getEntityType(about);
    const entityFQN = getEntityFQN(about);
    let body;
    let path: string;
    switch (type) {
      case 'Task':
        body = t('message.user-assign-new-task', {
          user: createdBy,
        });
        path = getTaskDetailPath(toString(id)).pathname;

        break;
      case 'Conversation':
        body = t('message.user-mentioned-in-comment', {
          user: createdBy,
        });
        path = prepareFeedLink(entityType as string, entityFQN as string);
    }
    const notification = new Notification('Notification From OpenMetadata', {
      body: body,
      icon: Logo,
    });
    notification.onclick = () => {
      const isChrome = window.navigator.userAgent.indexOf('Chrome');
      // Applying logic to open a new window onclick of browser notification from chrome
      // As it does not open the concerned tab by default.
      if (isChrome > -1) {
        window.open(path);
      } else {
        history.push(path);
      }
    };
  };

  const governanceMenu = [
    {
      key: 'glossary',
      label: (
        <NavLink
          className="focus:no-underline"
          data-testid="appbar-item-glossary"
          style={navStyle(pathname.startsWith('/glossary'))}
          to={{
            pathname: ROUTES.GLOSSARY,
          }}>
          {t('label.glossary')}
        </NavLink>
      ),
    },
    {
      key: 'tags',
      label: (
        <NavLink
          className="focus:no-underline"
          data-testid="appbar-item-tags"
          style={navStyle(pathname.startsWith('/tags'))}
          to={{
            pathname: ROUTES.TAGS,
          }}>
          {t('label.classification')}
        </NavLink>
      ),
    },
  ];

  const handleKeyPress = useCallback((event) => {
    if (isCommandKeyPress(event) && event.key === Keys.K) {
      searchRef.current?.focus();
      event.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (shouldRequestPermission()) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.TASK_CHANNEL, (newActivity) => {
        if (newActivity) {
          const activity = JSON.parse(newActivity);
          setHasTaskNotification(true);
          showBrowserNotification(
            activity.about,
            activity.createdBy,
            activity.type,
            activity.task?.id
          );
        }
      });

      socket.on(SOCKET_EVENTS.MENTION_CHANNEL, (newActivity) => {
        if (newActivity) {
          const activity = JSON.parse(newActivity);
          setHasMentionNotification(true);
          showBrowserNotification(
            activity.about,
            activity.createdBy,
            activity.type,
            activity.task?.id
          );
        }
      });
    }

    return () => {
      socket && socket.off(SOCKET_EVENTS.TASK_CHANNEL);
      socket && socket.off(SOCKET_EVENTS.MENTION_CHANNEL);
    };
  }, [socket]);

  useEffect(() => {
    const targetNode = document.body;
    targetNode.addEventListener('keydown', handleKeyPress);

    return () => targetNode.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    if (profilePicture) {
      setIsImgUrlValid(true);
    }
  }, [profilePicture]);

  const handleLanguageChange = useCallback((langCode: string) => {
    setLanguage(langCode);
    i18next.changeLanguage(langCode);
    refreshPage();
  }, []);

  const handleModalCancel = useCallback(() => handleFeatureModal(false), []);

  const handleOnImageError = useCallback(() => {
    setIsImgUrlValid(false);
  }, []);

  const handleSelectOption = useCallback(
    (text) => {
      AppState.inPageSearchText = text;
    },
    [AppState]
  );

  const brandLogoUrl = useMemo(() => {
    return logoConfig?.customMonogramUrlPath ?? Logo;
  }, [logoConfig]);

  return (
    <>
      <div className="tw-h-16 tw-py-3 tw-border-b-2 tw-border-separator tw-bg-white">
        <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap tw-px-6">
          <div className="tw-flex tw-items-center tw-flex-row tw-justify-between tw-flex-nowrap">
            <NavLink className="tw-flex-shrink-0" id="openmetadata_logo" to="/">
              <Image
                alt="OpenMetadata Logo"
                data-testid="image"
                fallback={Logo}
                height={30}
                preview={false}
                src={brandLogoUrl}
                width={25}
              />
            </NavLink>
            <Space className="tw-ml-5 flex-none" size={16}>
              <NavLink
                className="focus:tw-no-underline"
                data-testid="appbar-item-explore"
                style={navStyle(pathname.startsWith('/explore'))}
                to={{
                  pathname: '/explore/tables',
                }}>
                {t('label.explore')}
              </NavLink>
              <NavLink
                className="focus:tw-no-underline"
                data-testid="appbar-item-data-quality"
                style={navStyle(pathname.includes(ROUTES.TEST_SUITES))}
                to={{
                  pathname: ROUTES.TEST_SUITES,
                }}>
                {t('label.quality')}
              </NavLink>
              <NavLink
                className="focus:tw-no-underline"
                data-testid="appbar-item-data-insight"
                style={navStyle(pathname.includes(ROUTES.DATA_INSIGHT))}
                to={{
                  pathname: ROUTES.DATA_INSIGHT,
                }}>
                {t('label.insight-plural')}
              </NavLink>
              <Dropdown
                className="cursor-pointer"
                menu={{ items: governanceMenu }}
                trigger={['click']}>
                <Space data-testid="governance" size={2}>
                  {t('label.govern')}
                  <DropDownIcon style={{ marginLeft: 0, marginTop: '8px' }} />
                </Space>
              </Dropdown>
            </Space>
          </div>
          <div
            className="tw-flex-none tw-relative tw-justify-items-center tw-ml-16 appbar-search"
            data-testid="appbar-item">
            <Input
              addonBefore={entitiesSelect}
              autoComplete="off"
              className="search-grey rounded-4"
              data-testid="searchBox"
              id="searchBox"
              placeholder={t('message.search-for-entity-types')}
              ref={searchRef}
              style={{
                boxShadow: 'none',
                height: '37px',
              }}
              suffix={
                <span className="tw-flex tw-items-center">
                  <CmdKIcon />
                  <span className="tw-cursor-pointer tw-mb-2 tw-ml-3 tw-w-4 tw-h-4 tw-text-center">
                    {searchValue ? (
                      <SVGIcons
                        alt="icon-cancel"
                        icon={cancelIcon}
                        onClick={() => {
                          handleClear();
                        }}
                      />
                    ) : (
                      <SVGIcons
                        alt="icon-search"
                        icon={searchIcon}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOnClick();
                        }}
                      />
                    )}
                  </span>
                </span>
              }
              type="text"
              value={searchValue}
              onBlur={() => {
                setSearchIcon('icon-searchv1');
                setCancelIcon('close-circle-outlined');
              }}
              onChange={(e) => {
                const { value } = e.target;
                debounceOnSearch(value);
                handleSearchChange(value);
              }}
              onFocus={() => {
                setSearchIcon('icon-searchv1color');
                setCancelIcon('close-circle-outlined-color');
              }}
              onKeyDown={handleKeyDown}
            />
            {!isTourRoute &&
              searchValue &&
              (isInPageSearchAllowed(pathname) ? (
                <SearchOptions
                  isOpen={isSearchBoxOpen}
                  options={inPageSearchOptions(pathname)}
                  searchText={searchValue}
                  selectOption={handleSelectOption}
                  setIsOpen={handleSearchBoxOpen}
                />
              ) : (
                <Suggestions
                  isOpen={isSearchBoxOpen}
                  searchCriteria={
                    searchCriteria === '' ? undefined : searchCriteria
                  }
                  searchText={suggestionSearch}
                  setIsOpen={handleSearchBoxOpen}
                />
              ))}
          </div>
          <Space className="tw-ml-auto">
            <Space size={16}>
              <Select
                bordered={false}
                options={languageSelectOptions}
                value={language}
                onChange={handleLanguageChange}
              />
              <NavLink
                className="focus:tw-no-underline"
                data-testid="appbar-item-settings"
                style={navStyle(pathname.startsWith('/settings'))}
                to={{
                  pathname: ROUTES.SETTINGS,
                }}>
                {t('label.setting-plural')}
              </NavLink>
              <button className="focus:tw-no-underline hover:tw-underline tw-flex-shrink-0 ">
                <Dropdown
                  destroyPopupOnHide
                  dropdownRender={() => (
                    <NotificationBox
                      hasMentionNotification={hasMentionNotification}
                      hasTaskNotification={hasTaskNotification}
                      onMarkMentionsNotificationRead={
                        handleMentionsNotificationRead
                      }
                      onMarkTaskNotificationRead={handleTaskNotificationRead}
                      onTabChange={handleActiveTab}
                    />
                  )}
                  overlayStyle={{
                    zIndex: 9999,
                    width: '425px',
                    minHeight: '375px',
                  }}
                  placement="bottomRight"
                  trigger={['click']}
                  onOpenChange={handleBellClick}>
                  <Badge dot={hasTaskNotification || hasMentionNotification}>
                    <SVGIcons
                      alt="Alert bell icon"
                      icon={Icons.ALERT_BELL}
                      width="18"
                    />
                  </Badge>
                </Dropdown>
              </button>
              <div className="tw-flex tw-flex-shrink-0 tw--ml-2 tw-items-center ">
                <LegacyDropDown
                  dropDownList={supportDropdown}
                  icon={
                    <SVGIcons
                      alt="Doc icon"
                      className="tw-align-middle tw-mt-0.5 tw-mr-1"
                      icon={Icons.HELP_CIRCLE}
                      width="18"
                    />
                  }
                  isDropDownIconVisible={false}
                  isLableVisible={false}
                  label="Need Help"
                  type="link"
                />
              </div>
            </Space>
            <div data-testid="dropdown-profile">
              <LegacyDropDown
                dropDownList={profileDropdown}
                icon={
                  <Tooltip placement="bottom" title="Profile" trigger="hover">
                    {isImgUrlValid ? (
                      <div className="profile-image square tw--mr-2">
                        <Image
                          alt="user"
                          preview={false}
                          referrerPolicy="no-referrer"
                          src={profilePicture || ''}
                          onError={handleOnImageError}
                        />
                      </div>
                    ) : (
                      <Avatar name={username} width="30" />
                    )}
                  </Tooltip>
                }
                isDropDownIconVisible={false}
                type="link"
              />
            </div>
          </Space>
        </div>
        <WhatsNewModal
          header={`${t('label.whats-new')}!`}
          visible={isFeatureModalOpen}
          onCancel={handleModalCancel}
        />
      </div>
    </>
  );
};

export default NavBar;
