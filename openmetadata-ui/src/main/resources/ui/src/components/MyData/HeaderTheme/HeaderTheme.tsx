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
import { PageHeader, Typography } from '@openmetadata/ui-core-components';
import { Button } from 'antd';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { headerBackgroundColors } from '../../../constants/Mydata.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { getLandingPageHeaderTintStyle } from '../HomeLandingPage/landingPageHeaderColor';
import './header-theme.less';

interface HeaderThemeProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}

const HeaderTheme = ({ selectedColor, setSelectedColor }: HeaderThemeProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const displayName = getEntityName(currentUser);
  // The colour is laid on the home page's header as a light wash, so the
  // preview renders that same header rather than a swatch of the raw colour.
  const tintStyle = getLandingPageHeaderTintStyle(selectedColor);

  const handleColorClick = (color: string) => {
    setSelectedColor(color);
  };

  return (
    <div className="header-theme-settings">
      <Typography
        as="h1"
        className="header-theme-title display-xs font-semibold">
        {t('label.preview-header')}
      </Typography>
      <PageHeader
        data-testid="modal-header-theme"
        density="comfortable"
        icon={
          currentUser?.name ? (
            <ProfilePicture
              displayName={displayName}
              name={currentUser.name}
              width="42"
            />
          ) : null
        }
        style={tintStyle}
        subtitle={t('message.home-landing-page-subtitle')}
        title={t('message.hi-user', {
          user: displayName ? startCase(displayName) : t('label.user'),
        })}
        variant={tintStyle ? 'flat' : 'gradient'}
      />
      <div className="select-background-container">
        <Typography className="display-xs font-semibold">
          {t('label.select-background')}
        </Typography>
        <div className="select-background-options p-y-lg p-x-0 d-flex flex-wrap items-center">
          <div className="d-flex flex-wrap items-center gap-2">
            {headerBackgroundColors.map((value) => (
              <Button
                className="option-color-container cursor-pointer"
                data-testid="option-color"
                key={value.color}
                style={{
                  backgroundColor: value.color,
                  borderColor: value.color,
                }}
                onClick={() => handleColorClick(value.color)}>
                <div
                  className={`option-color w-full h-full ${
                    selectedColor === value.color ? 'white-border' : ''
                  }`}
                />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderTheme;
