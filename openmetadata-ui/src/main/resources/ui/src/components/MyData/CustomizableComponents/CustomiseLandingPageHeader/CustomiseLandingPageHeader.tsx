/*
 *  Copyright 2025 Collate.
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
import { Button, Input, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/filter.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as IconSuggestionsActive } from '../../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../../assets/svg/ic-suggestions-blue.svg';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import { EntityReference } from '../../../../generated/entity/type';
import { Page } from '../../../../generated/system/ui/page';
import { PageType } from '../../../../generated/system/ui/uiCustomization';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { useSearchStore } from '../../../../hooks/useSearchStore';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { getRecentlyViewedData } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { isCommandKeyPress, Keys } from '../../../../utils/KeyboardUtil';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import DomainSelectableList from '../../../common/DomainSelectableList/DomainSelectableList.component';
import CustomiseHomeModal from '../CustomiseHomeModal/CustomiseHomeModal';
import './customise-landing-page-header.less';
import { CustomiseLandingPageHeaderProps } from './CustomiseLandingPageHeader.interface';

const CustomiseLandingPageHeader = ({
  addedWidgetsList,
  handleAddWidget,
  hideCustomiseButton = false,
  overlappedContainer = false,
  onHomePage = false,
  backgroundColor,
  onBackgroundColorUpdate,
  placeholderWidgetKey,
}: CustomiseLandingPageHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { activeDomain, activeDomainEntityRef, updateActiveDomain } =
    useDomainStore();
  const { isNLPEnabled, isNLPActive, setNLPActive } = useSearchStore();
  const { document } = useCustomizeStore();
  const [showCustomiseHomeModal, setShowCustomiseHomeModal] = useState(false);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const searchRef = useRef<any>(null);

  const defaultBackgroundColor = useMemo(
    () =>
      document?.data?.pages?.find(
        (item: Page) => item.pageType === PageType.LandingPage
      )?.homePageBannerBackgroundColor,
    [document]
  );

  const bgColor =
    backgroundColor ?? defaultBackgroundColor ?? DEFAULT_HEADER_BG_COLOR;

  const recentlyViewData = useMemo(() => {
    const entities = getRecentlyViewedData();

    return entities.map((entity) => {
      return {
        icon: (
          <img
            alt={get(entity, 'service.displayName', '')}
            className="entity-icon"
            src={serviceUtilClassBase.getServiceTypeLogo(
              entity as unknown as SearchSourceAlias
            )}
          />
        ),
        name: entity.displayName,
      };
    });
  }, []);

  const handleOpenCustomiseHomeModal = () => {
    setShowCustomiseHomeModal(true);
  };

  const handleCloseCustomiseHomeModal = () => {
    setShowCustomiseHomeModal(false);
  };

  const handleDomainChange = useCallback(
    async (domain: EntityReference | EntityReference[]) => {
      updateActiveDomain(domain as EntityReference);
      setIsDomainDropdownOpen(false);
      navigate(0);
    },
    [updateActiveDomain, navigate]
  );

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (isCommandKeyPress(event) && event.key === Keys.K) {
      searchRef.current?.focus();
      event.preventDefault();
    }
  }, []);

  const handleSearchKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        const searchValue = event.currentTarget.value.trim();
        if (searchValue) {
          navigate(`/explore?search=${encodeURIComponent(searchValue)}`);
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const targetNode = (window.document as Document).body;
    if (!targetNode) {
      return;
    }

    targetNode.addEventListener('keydown', handleKeyPress);

    return () => {
      targetNode.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  return (
    <div className="customise-landing-page" style={{ background: bgColor }}>
      <div className="header-container">
        <div className="dashboardHeader">
          <div className="d-flex items-center gap-4 mb-5">
            <Typography.Text className="welcome-user">
              {t('label.welcome', {
                name: currentUser?.displayName ?? currentUser?.name,
              })}
            </Typography.Text>
            {!hideCustomiseButton && (
              <Button
                className="customise-header-btn"
                data-testid="customise-header-btn"
                icon={
                  <Icon
                    component={FilterIcon}
                    style={{ fontSize: '16px', color: 'white' }}
                  />
                }
                onClick={handleOpenCustomiseHomeModal}
              />
            )}
          </div>
          <div className="mb-9 customise-search-container">
            <div className="d-flex items-center gap-4 mb-9">
              <div className="flex-center search-input">
                {isNLPEnabled && (
                  <Tooltip
                    title={
                      isNLPActive
                        ? t('message.natural-language-search-active')
                        : t('label.use-natural-language-search')
                    }>
                    <Button
                      className={classNames('nlp-search-button w-6 h-6', {
                        active: isNLPActive,
                      })}
                      data-testid="nlp-suggestions-button"
                      icon={
                        <Icon
                          component={
                            isNLPActive
                              ? IconSuggestionsActive
                              : IconSuggestionsBlue
                          }
                          style={{ fontSize: '20px' }}
                        />
                      }
                      type="text"
                      onClick={() => setNLPActive(!isNLPActive)}
                    />
                  </Tooltip>
                )}
                <Input
                  autoComplete="off"
                  bordered={false}
                  className="rounded-4 appbar-search"
                  data-testid="customise-searchbox"
                  id="customise-searchbox"
                  placeholder={t('label.search-for-type', {
                    type: 'Tables, Database, Schema...',
                  })}
                  ref={searchRef}
                  type="text"
                  onKeyDown={handleSearchKeyPress}
                />
              </div>
              <DomainSelectableList
                hasPermission
                showAllDomains
                popoverProps={{
                  open: isDomainDropdownOpen,
                  onOpenChange: (open) => {
                    setIsDomainDropdownOpen(open);
                  },
                }}
                selectedDomain={activeDomainEntityRef}
                wrapInButton={false}
                onCancel={() => setIsDomainDropdownOpen(false)}
                onUpdate={handleDomainChange}>
                <div
                  className={classNames(
                    'd-flex items-center gap-2 border-radius-sm p-y-sm p-x-md bg-white domain-selector',
                    {
                      'domain-active': activeDomain !== DEFAULT_DOMAIN_VALUE,
                    }
                  )}
                  data-testid="domain-selector"
                  onClick={() =>
                    setIsDomainDropdownOpen(!isDomainDropdownOpen)
                  }>
                  <DomainIcon
                    className="domain-icon"
                    data-testid="domain-icon"
                    height={22}
                    width={22}
                  />
                  <Typography.Text className="text-sm font-medium domain-title">
                    {activeDomainEntityRef
                      ? getEntityName(activeDomainEntityRef)
                      : activeDomain}
                  </Typography.Text>
                  <DropdownIcon
                    className="dropdown-icon"
                    data-testid="dropdown-icon"
                    height={14}
                    width={14}
                  />
                </div>
              </DomainSelectableList>
            </div>
            {recentlyViewData.length > 0 && (
              <div className="customise-recently-viewed-data">
                {recentlyViewData.map((data) => (
                  <div
                    className="recent-item d-flex flex-col items-center gap-3"
                    key={data.name}>
                    <div className="d-flex items-center justify-center entity-icon-container">
                      {data.icon}
                    </div>
                    <Typography.Text className="text-sm font-medium text-white wrap-text">
                      {data.name}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="announcements" />
      </div>
      {overlappedContainer && <div className="overlapped-container" />}

      {!hideCustomiseButton && showCustomiseHomeModal && (
        <CustomiseHomeModal
          addedWidgetsList={addedWidgetsList}
          currentBackgroundColor={bgColor}
          handleAddWidget={handleAddWidget}
          open={showCustomiseHomeModal}
          placeholderWidgetKey={placeholderWidgetKey}
          onBackgroundColorUpdate={onBackgroundColorUpdate}
          onClose={handleCloseCustomiseHomeModal}
          onHomePage={onHomePage}
        />
      )}
    </div>
  );
};

export default CustomiseLandingPageHeader;
