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
import React from 'react';
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
      <Typography.Title className="header-theme-title">
        {t('label.preview-header')}
      </Typography.Title>
      <div className="header-theme-container">
        <CustomiseLandingPageHeader
          hideCustomiseButton
          backgroundColor={selectedColor}
        />
      </div>
      <div className="select-background-container">
        <Typography.Text className="select-background-text">
          {t('label.select-background')}
        </Typography.Text>
        <div className="select-background-options ">
          <div className="background-preview">
            <Typography.Text className="text-sm font-semibold">
              {t('label.custom')}
            </Typography.Text>
            <div
              className="color-preview"
              style={{
                borderColor: selectedColor,
              }}>
              <div
                className="color-preview-inner"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
            <div className="color-hex-code">{selectedColor}</div>
          </div>
          <div className="background-options">
            {headerBackgroundColors.map((value) => (
              <div
                className="option-color"
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
