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
import { Button, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/filter.svg';
import LandingPageBg from '../../../../assets/svg/landing-page-header-bg.svg';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
} from '../../../../rest/announcementsAPI';
import { isLinearGradient } from '../../../../utils/ColorUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import './customise-landing-page-header.less';
import { CustomiseLandingPageHeaderProps } from './CustomiseLandingPageHeader.interface';
import CustomiseSearchBar from './CustomiseSearchBar';

const AnnouncementsWidgetV1 = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../Widgets/AnnouncementsWidgetV1/AnnouncementsWidgetV1.component'
      )
  )
);

const CustomiseHomeModal = withSuspenseFallback(
  lazy(() => import('../CustomiseHomeModal/CustomiseHomeModal'))
);

const LandingPageDomainSelector = lazy(
  () => import('./LandingPageDomainSelector')
);

const RecentlyViewedCarousel = lazy(() => import('./RecentlyViewedCarousel'));

const DomainSelectorPlaceholder = () => (
  <div className="border-radius-sm p-x-md bg-white domain-selector" />
);

const CustomiseLandingPageHeader = ({
  addedWidgetsList,
  backgroundColor,
  dataTestId,
  handleAddWidget,
  hideCustomiseButton = false,
  isPreviewHeader = false,
  onBackgroundColorUpdate,
  onHomePage = false,
  overlappedContainer = false,
  placeholderWidgetKey,
  announcements: announcementsFromParent,
  isAnnouncementLoading: isAnnouncementLoadingFromParent,
}: CustomiseLandingPageHeaderProps) => {
  const { t } = useTranslation();
  const { currentUser, applicationConfig } = useApplicationStore();
  const [showCustomiseHomeModal, setShowCustomiseHomeModal] = useState(false);
  // Internal fallback state — only used when the parent doesn't pass announcements through.
  // The landing page (MyDataPage) already fetches global announcements for the sidebar
  // widget; passing them down here de-duplicates the {@code GET /announcements/active} call.
  // Standalone callers (customize-page preview, header-theme picker) still hit the API.
  const [internalAnnouncements, setInternalAnnouncements] = useState<
    AnnouncementEntity[]
  >([]);
  const [internalIsAnnouncementLoading, setInternalIsAnnouncementLoading] =
    useState(true);
  const announcements = announcementsFromParent ?? internalAnnouncements;
  const isAnnouncementLoading =
    isAnnouncementLoadingFromParent ?? internalIsAnnouncementLoading;
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const adminPanelBackgroundColor =
    applicationConfig?.customTheme?.panelBackgroundColor;
  const bgColor =
    backgroundColor || adminPanelBackgroundColor || DEFAULT_HEADER_BG_COLOR;

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

  const fetchAnnouncements = useCallback(async () => {
    try {
      setInternalIsAnnouncementLoading(true);
      const response = await getActiveAnnouncements();

      setInternalAnnouncements(response.data);
      setShowAnnouncements(response.data.length > 0);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setShowAnnouncements(false);
    } finally {
      setInternalIsAnnouncementLoading(false);
    }
  }, []);

  const handleOpenCustomiseHomeModal = () => {
    setShowCustomiseHomeModal(true);
  };

  const handleCloseCustomiseHomeModal = () => {
    setShowCustomiseHomeModal(false);
  };

  useEffect(() => {
    // Skip the duplicate fetch when the parent already provided announcements. Keep showing
    // them when non-empty, mirroring what the internal fetch path does.
    if (announcementsFromParent !== undefined) {
      setShowAnnouncements(announcementsFromParent.length > 0);

      return;
    }
    fetchAnnouncements();
  }, [announcementsFromParent, fetchAnnouncements]);

  return (
    <div
      className="customise-landing-page-header"
      data-testid={dataTestId}
      style={landingPageStyle}>
      <div className="header-container">
        <div className="dashboard-header">
          <div
            className={classNames('d-flex items-center gap-4 mb-5', {
              'justify-center': !showAnnouncements,
            })}>
            <Typography.Text className="welcome-user">
              {t('label.welcome', {
                name: currentUser?.displayName || currentUser?.name,
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
              <Suspense fallback={<DomainSelectorPlaceholder />}>
                <LandingPageDomainSelector disabled={!onHomePage} />
              </Suspense>
            </div>
            {!isPreviewHeader && (
              <Suspense fallback={null}>
                <RecentlyViewedCarousel
                  disabled={!onHomePage}
                  showAnnouncements={showAnnouncements}
                />
              </Suspense>
            )}
          </div>
        </div>

        {!isPreviewHeader &&
          showAnnouncements &&
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
