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
import { debounce, startCase, upperCase } from 'lodash';
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
import { ReactComponent as RefreshIcon } from '../../assets/svg/ic-refresh.svg';
import { ReactComponent as IconSearch } from '../../assets/svg/search.svg';
import {
  NOTIFICATION_READ_TIMER,
  SOCKET_EVENTS,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { HELP_ITEMS_ENUM } from '../../constants/Navbar.constants';
import { useWebSocketConnector } from '../../context/WebSocketProvider/WebSocketProvider';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import { BackgroundJob, JobType } from '../../generated/jobs/backgroundJob';
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
import { getCustomPropertyEntityPathname } from '../../utils/CustomProperty.utils';
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
  getSettingPath,
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { ActivityFeedTabs } from '../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import SearchOptions from '../AppBar/SearchOptions';
import Suggestions from '../AppBar/Suggestions';
import CmdKIcon from '../common/CmdKIcon/CmdKIcon.component';
import DomainSelectableList from '../common/DomainSelectableList/DomainSelectableList.component';
import { useEntityExportModalProvider } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { CSVExportWebsocketResponse } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
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
  const { onUpdateCSVExportJob } = useEntityExportModalProvider();
  const { searchCriteria, updateSearchCriteria } = useApplicationStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const Logo = useMemo(() => brandImageClassBase.getMonogram().src, []);
  const [showVersionMissMatchAlert, setShowVersionMissMatchAlert] =
    useState(false);
  const location = useCustomLocation();
  const history = useHistory();
  const { activeDomain, activeDomainEntityRef, updateActiveDomain } =
    useDomainStore();
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
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const domainContainerRef = useRef<HTMLDivElement>(null);

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
    type: string,
    backgroundJobData?: BackgroundJob
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

        break;

      case 'BackgroundJob': {
        if (!backgroundJobData) {
          break;
        }

        const { jobArgs, status, jobType } = backgroundJobData;

        if (jobType === JobType.CustomPropertyEnumCleanup) {
          body = t('message.custom-property-update', {
            propertyName: jobArgs.propertyName,
            entityName: jobArgs.entityType,
            status: startCase(status.toLowerCase()),
          });

          path = getSettingPath(
            GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
            getCustomPropertyEntityPathname(jobArgs.entityType)
          );
        }

        break;
      }
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
      // Compare version only if version is set previously to have fair comparison
      if (version && version !== newVersion.version) {
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

      socket.on(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, (exportResponse) => {
        if (exportResponse) {
          const exportResponseData = JSON.parse(
            exportResponse
          ) as CSVExportWebsocketResponse;

          onUpdateCSVExportJob(exportResponseData);
        }
      });
      socket.on(SOCKET_EVENTS.BACKGROUND_JOB_CHANNEL, (jobResponse) => {
        if (jobResponse) {
          const jobResponseData: BackgroundJob = JSON.parse(jobResponse);
          showBrowserNotification(
            '',
            jobResponseData.createdBy,
            'BackgroundJob',
            jobResponseData
          );
        }
      });
    }

    return () => {
      socket && socket.off(SOCKET_EVENTS.TASK_CHANNEL);
      socket && socket.off(SOCKET_EVENTS.MENTION_CHANNEL);
      socket && socket.off(SOCKET_EVENTS.CSV_EXPORT_CHANNEL);
      socket && socket.off(SOCKET_EVENTS.CSV_EXPORT_CHANNEL);
      socket && socket.off(SOCKET_EVENTS.BACKGROUND_JOB_CHANNEL);
    };
  }, [socket]);

  useEffect(() => {
    fetchOMVersion();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the domain-select-popover
      const isClickInPopover = (event.target as Element)?.closest(
        '.domain-select-popover'
      );

      if (
        domainContainerRef.current &&
        !domainContainerRef.current.contains(event.target as Node) &&
        !isClickInPopover &&
        isDomainDropdownOpen
      ) {
        setIsDomainDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDomainDropdownOpen]);

  useEffect(() => {
    const targetNode = document.body;
    targetNode.addEventListener('keydown', handleKeyPress);

    return () => targetNode.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const handleDomainChange = useCallback(
    async (domain: EntityReference | EntityReference[]) => {
      updateActiveDomain(domain as EntityReference);
      setIsDomainDropdownOpen(false);
      refreshPage();
    },
    []
  );

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
                        data-testid="cancel-icon"
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
          <div className="d-flex" ref={domainContainerRef}>
            <DomainSelectableList
              hasPermission
              popoverProps={{ open: isDomainDropdownOpen }}
              selectedDomain={activeDomainEntityRef}
              onUpdate={handleDomainChange}>
              <Row
                data-testid="domain-dropdown"
                gutter={6}
                onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}>
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
            </DomainSelectableList>
          </div>

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
                history.go(0);
              }}>
              {t('label.refresh')}
            </Button>
          }
          className="refresh-alert slide-in-top"
          description="For a seamless experience recommend you to refresh the page"
          icon={<RefreshIcon />}
          message="A new version is available"
          type="info"
        />
      )}
      {renderAlertCards}
    </>
  );
};

export default NavBar;
