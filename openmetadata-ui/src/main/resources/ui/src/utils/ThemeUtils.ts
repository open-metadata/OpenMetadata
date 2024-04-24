/*
 *  Copyright 2024 Collate.
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
import { DEFAULT_THEME } from '../constants/Appearance.constants';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';

export const getThemeConfig = (theme?: UIThemePreference['customTheme']) => {
  return {
    primaryColor: theme?.primaryColor || DEFAULT_THEME.primaryColor,
    errorColor: theme?.errorColor || DEFAULT_THEME.errorColor,
    successColor: theme?.successColor || DEFAULT_THEME.successColor,
    warningColor: theme?.warningColor || DEFAULT_THEME.warningColor,
    infoColor: theme?.infoColor || DEFAULT_THEME.infoColor,
  };
};
