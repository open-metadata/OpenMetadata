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

import Icon from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Col,
  Dropdown,
  Input,
  InputRef,
  Popover,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import i18next from 'i18next';
import { debounce, upperCase } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconCloseCircleOutlined } from '../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as DropDownIcon } from '../../assets/svg/drop-down.svg';
import { ReactComponent as IconBell } from '../../assets/svg/ic-alert-bell.svg';
import { ReactComponent as DomainIcon } from '../../assets/svg/ic-domain.svg';
import { ReactComponent as Help } from '../../assets/svg/ic-help.svg';
import { ReactComponent as IconSearch } from '../../assets/svg/search.svg';
import {
  NOTIFICATION_READ_TIMER,
  SOCKET_EVENTS,
} from '../../constants/constants';
import { HELP_ITEMS_ENUM } from '../../constants/Navbar.constants';
import { useWebSocketConnector } from '../../context/WebSocketProvider/WebSocketProvider';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../hooks/useDomainStore';
import { getVersion } from '../../rest/miscAPI';
import { isProtectedRoute } from '../../utils/AuthProvider.util';
import brandImageClassBase from '../../utils/BrandImage/BrandImageClassBase';
import {
  hasNotificationPermission,
  shouldRequestPermission,
} from '../../utils/BrowserNotificationUtils';
import { refreshPage } from '../../utils/CommonUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../utils/FeedUtils';
import {
  languageSelectOptions,
  SupportedLocales,
} from '../../utils/i18next/i18nextUtil';
import { isCommandKeyPress, Keys } from '../../utils/KeyboardUtil';
import { getHelpDropdownItems } from '../../utils/NavbarUtils';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { ActivityFeedTabs } from '../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import SearchOptions from '../AppBar/SearchOptions';
import Suggestions from '../AppBar/Suggestions';
import CmdKIcon from '../common/CmdKIcon/CmdKIcon.component';
import WhatsNewModal from '../Modals/WhatsNewModal/WhatsNewModal';
import NotificationBox from '../NotificationBox/NotificationBox.component';
import { UserProfileIcon } from '../Settings/Users/UserProfileIcon/UserProfileIcon.component';
import './nav-bar.less';
import { NavBarProps } from './NavBar.interface';
import popupAlertsCardsClassBase from './PopupAlertClassBase';

const cookieStorage = new CookieStorage();

const NavBar = ({
  searchValue,
  isTourRoute = false,
  pathname,
  isSearchBoxOpen,
  handleSearchBoxOpen,
  handleSearchChange,
  handleKeyDown,
  handleOnClick,
  handleClear,
}: NavBarProps) => {
  const { searchCriteria, updateSearchCriteria } = useApplicationStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const Logo = useMemo(() => brandImageClassBase.getMonogram().src, []);
  const [showVersionMissMatchAlert, setShowVersionMissMatchAlert] =
    useState(false);
  const location = useCustomLocation();
  const history = useHistory();
  const {
    domainOptions,
    activeDomain,
    activeDomainEntityRef,
    updateActiveDomain,
  } = useDomainStore();
  const { t } = useTranslation();
  const { Option } = Select;
  const searchRef = useRef<InputRef>(null);
  const [isSearchBlur, setIsSearchBlur] = useState<boolean>(true);
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const [hasTaskNotification, setHasTaskNotification] =
    useState<boolean>(false);
  const [hasMentionNotification, setHasMentionNotification] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('Task');
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState<boolean>(false);
  const [version, setVersion] = useState<string>();

  const fetchOMVersion = async () => {
    try {
      const res = await getVersion();
      setVersion(res.version);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.version'),
        })
      );
    }
  };

  const renderAlertCards = useMemo(() => {
    const cardList = popupAlertsCardsClassBase.alertsCards();

    return cardList.map(({ key, component }) => {
      const Component = component;

      return <Component key={key} />;
    });
  }, []);

  const handleSupportClick = ({ key }: MenuInfo): void => {
    if (key === HELP_ITEMS_ENUM.WHATS_NEW) {
      setIsFeatureModalOpen(true);
    }
  };

  const entitiesSelect = useMemo(
    () => (
      <Select
        defaultActiveFirstOption
        className="global-search-select"
        data-testid="global-search-selector"
        listHeight={300}
        popupClassName="global-search-select-menu"
        value={searchCriteria}
        onChange={updateSearchCriteria}>
        {searchClassBase.getGlobalSearchOptions().map(({ value, label }) => (
          <Option
            data-testid={`global-search-select-option-${label}`}
            key={value}
            value={value}>
            {label}
          </Option>
        ))}
      </Select>
    ),
    [searchCriteria]
  );

  const language = useMemo(
    () =>
      (cookieStorage.getItem('i18next') as SupportedLocales) ||
      SupportedLocales.English,
    []
  );

  const { socket } = useWebSocketConnector();

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
    type: string
  ) => {
    if (!hasNotificationPermission()) {
      return;
    }
    const entityType = getEntityType(about);
    const entityFQN = getEntityFQN(about) ?? '';
    let body;
    let path: string;
    switch (type) {
      case 'Task':
        body = t('message.user-assign-new-task', {
          user: createdBy,
        });

        path = entityUtilClassBase.getEntityLink(
          entityType as EntityType,
          entityFQN,
          EntityTabs.ACTIVITY_FEED,
          ActivityFeedTabs.TASKS
        );

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

    const handleDocumentVisibilityChange = async () => {
      if (isProtectedRoute(location.pathname) && isTourRoute) {
        return;
      }
      const newVersion = await getVersion();
      if (version !== newVersion.version) {
        setShowVersionMissMatchAlert(true);
      }
    };

    addEventListener('focus', handleDocumentVisibilityChange);

    return () => {
      removeEventListener('focus', handleDocumentVisibilityChange);
    };
  }, [isTourRoute, version]);

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.TASK_CHANNEL, (newActivity) => {
        if (newActivity) {
          const activity = JSON.parse(newActivity);
          setHasTaskNotification(true);
          showBrowserNotification(
            activity.about,
            activity.createdBy,
            activity.type
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
            activity.type
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
    fetchOMVersion();
  }, []);

  useEffect(() => {
    const targetNode = document.body;
    targetNode.addEventListener('keydown', handleKeyPress);

    return () => targetNode.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const handleDomainChange = useCallback(({ key }) => {
    updateActiveDomain(key);
    refreshPage();
  }, []);

  const handleLanguageChange = useCallback(({ key }) => {
    i18next.changeLanguage(key);
    refreshPage();
  }, []);

  const handleModalCancel = useCallback(() => setIsFeatureModalOpen(false), []);

  const handleSelectOption = useCallback((text: string) => {
    history.replace({
      search: `?withinPageSearch=${text}`,
    });
  }, []);

  return (
    <>
      <div className="navbar-container bg-white flex-nowrap w-full">
        <div
          className="m-auto relative"
          data-testid="navbar-search-container"
          ref={searchContainerRef}>
          <Popover
            content={
              !isTourRoute &&
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
              ))
            }
            getPopupContainer={() =>
              searchContainerRef.current || document.body
            }
            open={isSearchBoxOpen}
            overlayClassName="global-search-overlay"
            overlayStyle={{ width: '100%', paddingTop: 0 }}
            placement="bottomRight"
            showArrow={false}
            trigger={['click']}
            onOpenChange={handleSearchBoxOpen}>
            <Input
              addonBefore={entitiesSelect}
              autoComplete="off"
              className="rounded-4  appbar-search"
              data-testid="searchBox"
              id="searchBox"
              placeholder={t('label.search-for-type', {
                type: t('label.data-asset-plural'),
              })}
              ref={searchRef}
              style={{
                height: '37px',
              }}
              suffix={
                <span className="d-flex items-center">
                  <CmdKIcon />
                  <span className="cursor-pointer m-b-xs m-l-sm w-4 h-4 text-center">
                    {searchValue ? (
                      <Icon
                        alt="icon-cancel"
                        className={classNames('align-middle', {
                          'text-primary': !isSearchBlur,
                        })}
                        component={IconCloseCircleOutlined}
                        style={{ fontSize: '16px' }}
                        onClick={handleClear}
                      />
                    ) : (
                      <Icon
                        alt="icon-search"
                        className={classNames('align-middle', {
                          'text-grey-3': isSearchBlur,
                          'text-primary': !isSearchBlur,
                        })}
                        component={IconSearch}
                        data-testid="search-icon"
                        style={{ fontSize: '16px' }}
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
                setIsSearchBlur(true);
              }}
              onChange={(e) => {
                const { value } = e.target;
                debounceOnSearch(value);
                handleSearchChange(value);
              }}
              onFocus={() => {
                setIsSearchBlur(false);
              }}
              onKeyDown={handleKeyDown}
            />
          </Popover>
        </div>

        <Space align="center" size={24}>
          <Dropdown
            className="cursor-pointer"
            menu={{
              items: domainOptions,
              onClick: handleDomainChange,
              className: 'domain-dropdown-menu',
              defaultSelectedKeys: [activeDomain],
            }}
            placement="bottomRight"
            trigger={['click']}>
            <Row data-testid="domain-dropdown" gutter={6}>
              <Col className="flex-center">
                <DomainIcon
                  className="d-flex text-base-color"
                  height={24}
                  name="domain"
                  width={24}
                />
              </Col>
              <Col className="flex-center">
                <Typography.Text>
                  {activeDomainEntityRef
                    ? getEntityName(activeDomainEntityRef)
                    : activeDomain}
                </Typography.Text>
              </Col>
              <Col className="flex-center">
                <DropDownIcon height={14} width={14} />
              </Col>
            </Row>
          </Dropdown>

          <Dropdown
            className="cursor-pointer"
            menu={{
              items: languageSelectOptions,
              onClick: handleLanguageChange,
            }}
            placement="bottomRight"
            trigger={['click']}>
            <Row gutter={2}>
              <Col>
                {upperCase(
                  (language || SupportedLocales.English).split('-')[0]
                )}
              </Col>
              <Col className="flex-center">
                <DropDownIcon height={14} width={14} />
              </Col>
            </Row>
          </Dropdown>

          <Dropdown
            destroyPopupOnHide
            className="cursor-pointer"
            dropdownRender={() => (
              <NotificationBox
                hasMentionNotification={hasMentionNotification}
                hasTaskNotification={hasTaskNotification}
                onMarkMentionsNotificationRead={handleMentionsNotificationRead}
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
            <Tooltip placement="top" title={t('label.notification-plural')}>
              <Badge dot={hasTaskNotification || hasMentionNotification}>
                <Icon
                  className="align-middle"
                  component={IconBell}
                  style={{ fontSize: '24px' }}
                />
              </Badge>
            </Tooltip>
          </Dropdown>

          <Dropdown
            menu={{
              items: getHelpDropdownItems(version),
              onClick: handleSupportClick,
            }}
            overlayStyle={{ width: 175 }}
            placement="bottomRight"
            trigger={['click']}>
            <Tooltip placement="top" title={t('label.need-help')}>
              <Icon
                className="align-middle"
                component={Help}
                data-testid="help-icon"
                style={{ fontSize: '24px' }}
              />
            </Tooltip>
          </Dropdown>

          <UserProfileIcon />
        </Space>
      </div>
      <WhatsNewModal
        header={`${t('label.whats-new')}!`}
        visible={isFeatureModalOpen}
        onCancel={handleModalCancel}
      />

      {showVersionMissMatchAlert && (
        <Alert
          showIcon
          action={
            <Button
              size="small"
              type="link"
              onClick={() => {
                location.reload();
              }}>
              {t('label.refresh')}
            </Button>
          }
          className="refresh-alert slide-in-top"
          description="For a seamless experience recommend you to refresh the page"
          icon={
            <svg
              fill="none"
              height="34"
              viewBox="0 0 34 34"
              width="34"
              xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_9647_49527)">
                <path
                  // eslint-disable-next-line max-len
                  d="M15.6719 23.4391V13.8251L12.9884 16.5767C12.4763 17.1019 11.6355 17.1124 11.1103 16.6003C10.5852 16.0882 10.5747 15.2473 11.0868 14.7222L16.0493 9.63362C16.2992 9.37736 16.6421 9.23279 17.0001 9.23279C17.3581 9.23279 17.701 9.37736 17.9509 9.63362L22.9133 14.7222C23.4255 15.2473 23.4149 16.0882 22.8898 16.6003C22.6316 16.8521 22.297 16.9776 21.9627 16.9776C21.6172 16.9776 21.272 16.8437 21.0117 16.5767L18.3281 13.8251V23.4391C18.3281 24.1727 17.7335 24.7673 17 24.7673C16.2665 24.7673 15.6719 24.1726 15.6719 23.4391ZM29.0209 4.97914C25.8099 1.76833 21.5409 0 17 0C12.4591 0 8.19008 1.76833 4.97914 4.97914C1.76833 8.19008 0 12.4591 0 17C0 21.5409 1.76833 25.8099 4.97914 29.0208C8.19008 32.2317 12.4591 34 17 34C20.3597 34 23.6088 33.0212 26.3962 31.1693C27.0072 30.7634 27.1734 29.9391 26.7675 29.3281C26.3616 28.7172 25.5373 28.5508 24.9263 28.9568C22.5759 30.5183 19.835 31.3438 17 31.3438C9.09082 31.3438 2.65625 24.9092 2.65625 17C2.65625 9.09082 9.09082 2.65625 17 2.65625C24.9092 2.65625 31.3438 9.09082 31.3438 17C31.3438 19.6974 30.5913 22.3251 29.1677 24.5993C28.7785 25.221 28.9671 26.0405 29.5888 26.4297C30.2102 26.8188 31.03 26.6304 31.4192 26.0086C33.1076 23.3114 34 20.1963 34 17C34 12.4591 32.2317 8.19008 29.0209 4.97914Z"
                  fill="#2856E0"
                />
              </g>
              <defs>
                <clipPath id="clip0_9647_49527">
                  <rect fill="white" height="34" width="34" />
                </clipPath>
              </defs>
            </svg>
          }
          message="A new version is available"
          type="info"
        />
      )}
      {renderAlertCards}
    </>
  );
};

export default NavBar;
