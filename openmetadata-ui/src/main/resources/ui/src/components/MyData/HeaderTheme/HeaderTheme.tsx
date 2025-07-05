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
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { headerBackgroundColors } from '../../../constants/Mydata.constants';
import CustomiseLandingPageHeader from '../CustomizableComponents/CustomiseLandingPageHeader/CustomiseLandingPageHeader';
import './header-theme.less';

interface HeaderThemeProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}

const HeaderTheme = ({ selectedColor, setSelectedColor }: HeaderThemeProps) => {
  const { t } = useTranslation();

  const handleColorClick = (color: string) => {
    setSelectedColor(color);
  };

  return (
    <div className="header-theme-settings">
      <Typography.Title className="header-theme-title display-xs font-semibold">
        {t('label.preview-header')}
      </Typography.Title>
      <div className="header-theme-container p-box bg-white">
        <CustomiseLandingPageHeader
          hideCustomiseButton
          backgroundColor={selectedColor}
        />
      </div>
      <div className="select-background-container">
        <Typography.Text className="display-xs font-semibold">
          {t('label.select-background')}
        </Typography.Text>
        <div className="select-background-options p-y-lg p-x-0 d-flex flex-wrap items-center">
          <div className="d-flex flex-wrap items-center gap-3">
            <Typography.Text className="text-sm font-semibold">
              {t('label.custom')}
            </Typography.Text>
            <div
              className="color-preview p-xss"
              style={{
                borderColor: selectedColor,
              }}>
              <div
                className="color-preview-inner w-full h-full"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
            <div className="color-hex-code p-xs text-md font-regular border-radius-xs">
              {selectedColor}
            </div>
          </div>
          <div className="d-flex flex-wrap items-center gap-2">
            {headerBackgroundColors.map((value) => (
              <div
                className="option-color cursor-pointer"
                key={value.color}
                style={{
                  borderColor: value.color,
                  backgroundColor: value.color,
                }}
                onClick={() => handleColorClick(value.color)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderTheme;
