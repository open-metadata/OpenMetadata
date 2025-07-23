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
import { Button, Carousel, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { get } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/filter.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import LandingPageBg from '../../../../assets/svg/landing-page-header-bg.svg';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import { Thread } from '../../../../generated/entity/feed/thread';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { getActiveAnnouncement } from '../../../../rest/feedsAPI';
import {
  getRecentlyViewedData,
  isLinearGradient,
} from '../../../../utils/CommonUtils';
import {
  CustomNextArrow,
  CustomPrevArrow,
} from '../../../../utils/CustomizableLandingPageUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DomainSelectableList from '../../../common/DomainSelectableList/DomainSelectableList.component';
import AnnouncementsWidgetV1 from '../../Widgets/AnnouncementsWidgetV1/AnnouncementsWidgetV1.component';
import CustomiseHomeModal from '../CustomiseHomeModal/CustomiseHomeModal';
import './customise-landing-page-header.less';
import { CustomiseLandingPageHeaderProps } from './CustomiseLandingPageHeader.interface';
import CustomiseSearchBar from './CustomiseSearchBar';

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
  const [showCustomiseHomeModal, setShowCustomiseHomeModal] = useState(false);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Thread[]>([]);
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(true);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const bgColor = backgroundColor ?? DEFAULT_HEADER_BG_COLOR;

  const landingPageStyle = useMemo(() => {
    const backgroundImage = isLinearGradient(bgColor)
      ? `${bgColor}, url(${LandingPageBg})` // gradient first (on top), image second
      : `url(${LandingPageBg})`;

    return {
      backgroundImage,
      backgroundColor: isLinearGradient(bgColor) ? undefined : bgColor, // for hex-only case
      backgroundBlendMode: isLinearGradient(bgColor) ? 'overlay' : 'normal',
    };
  }, [bgColor]);

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
        entityType: entity.entityType,
      };
    });
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsAnnouncementLoading(true);
      const response = await getActiveAnnouncement();

      setAnnouncements(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsAnnouncementLoading(false);
    }
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

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return (
    <div className="customise-landing-page" style={landingPageStyle}>
      <div className="header-container">
        <div className="dashboard-header">
          <div
            className={classNames('d-flex items-center gap-4 mb-5', {
              'justify-center': !showAnnouncements,
            })}>
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
              <CustomiseSearchBar disabled={!onHomePage} />
              <DomainSelectableList
                hasPermission
                showAllDomains
                disabled={!onHomePage}
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
                    'd-flex items-center gap-2 border-radius-sm p-x-md bg-white domain-selector',
                    {
                      'domain-active': activeDomain !== DEFAULT_DOMAIN_VALUE,
                      disabled: !onHomePage,
                    }
                  )}
                  data-testid="domain-selector"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setIsDomainDropdownOpen(!isDomainDropdownOpen);
                  }}>
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
              <Carousel
                arrows
                className={classNames('recently-viewed-data-carousel', {
                  'slick-list-center': !showAnnouncements,
                })}
                infinite={false}
                nextArrow={<CustomNextArrow />}
                prevArrow={<CustomPrevArrow />}
                slidesToScroll={6}
                slidesToShow={6}>
                {recentlyViewData.map((data, index) => (
                  <div
                    className={classNames('customise-recently-viewed-data', {
                      disabled: !onHomePage,
                    })}
                    key={index}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      navigate(`/${data.entityType}/${data.name}`);
                    }}>
                    <div
                      className="recent-item d-flex flex-col items-center gap-3"
                      key={data.name}>
                      <div className="d-flex items-center justify-center entity-icon-container">
                        {data.icon}
                      </div>
                      <Typography.Text
                        className="text-sm font-medium text-white wrap-text"
                        ellipsis={{ tooltip: true }}>
                        {data.name}
                      </Typography.Text>
                    </div>
                  </div>
                ))}
              </Carousel>
            )}
          </div>
        </div>

        {showAnnouncements &&
          !isAnnouncementLoading &&
          announcements.length > 0 && (
            <div className="announcements-container">
              <AnnouncementsWidgetV1
                announcements={announcements}
                currentBackgroundColor={bgColor}
                disabled={!onHomePage}
                onClose={() => {
                  setShowAnnouncements(false);
                }}
              />
            </div>
          )}
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
