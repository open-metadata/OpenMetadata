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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
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
      <Typography
        as="h1"
        className="header-theme-title display-xs font-semibold">
        {t('label.preview-header')}
      </Typography>
      <div className="header-theme-container p-box bg-white">
        <CustomiseLandingPageHeader
          hideCustomiseButton
          isPreviewHeader
          backgroundColor={selectedColor}
          dataTestId="modal-header-theme"
        />
      </div>
      <div className="select-background-container">
        <Typography className="display-xs font-semibold">
          {t('label.select-background')}
        </Typography>
        <Box align="center" className="tw:px-0 tw:py-6" gap={2} wrap="wrap">
          {headerBackgroundColors.map((value) => (
            <Button
              aria-label={value.label}
              aria-pressed={selectedColor === value.color}
              className="tw:size-13 tw:rounded-full tw:border-2 tw:border-solid tw:p-px!"
              color="tertiary"
              data-testid="option-color"
              iconLeading={
                <span
                  className={classNames(
                    'option-color tw:size-full tw:rounded-full',
                    {
                      'tw:border-3 tw:border-solid tw:border-bg-primary':
                        selectedColor === value.color,
                    }
                  )}
                />
              }
              key={value.color}
              style={{
                backgroundColor: value.color,
                borderColor: value.color,
              }}
              onPress={() => handleColorClick(value.color)}
            />
          ))}
        </Box>
      </div>
    </div>
  );
};

export default HeaderTheme;
