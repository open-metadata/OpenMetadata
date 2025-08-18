/*
 *  Copyright 2023 Collate.
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

import { AxiosResponse } from 'axios';
import axiosClient from '.';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { LineageSettings } from '../generated/configuration/lineageSettings';
import { LoginConfiguration } from '../generated/configuration/loginConfiguration';
import { SearchSettings } from '../generated/configuration/searchSettings';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { Settings, SettingType } from '../generated/settings/settings';

export const getSettingsConfigFromConfigType = async (
  configType: SettingType
): Promise<AxiosResponse<Settings>> => {
  const response = await axiosClient.get<Settings>(
    `/system/settings/${configType}`
  );

  return response;
};

export const updateSettingsConfig = async (payload: Settings) => {
  const response = await axiosClient.put<Settings>(`/system/settings`, payload);

  return response;
};

export const getCustomUiThemePreference = async () => {
  const response = await axiosClient.get<UIThemePreference>(
    `system/config/customUiThemePreference`
  );

  return response.data;
};

export const getLoginConfig = async () => {
  const response = await axiosClient.get<LoginConfiguration>(
    `system/config/loginConfig`
  );

  return response.data;
};

export const testEmailConnection = async (data: { email: string }) => {
  const response = await axiosClient.put<string>(
    '/system/email/test',
    data,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response;
};

export const getSettingsByType = async (
  settingType: SettingType
): Promise<SearchSettings | LineageSettings> => {
  const response = await axiosClient.get<Settings>(
    `/system/settings/${settingType}`
  );

  return response.data.config_value as SearchSettings | LineageSettings;
};

export const restoreSettingsConfig = async (settingType: SettingType) => {
  const response = await axiosClient.put<Settings>(
    `/system/settings/reset/${settingType}`
  );

  return response;
};

export const getSystemConfig = async () => {
  const response = await axiosClient.get<{
    basePath: string;
    rdfEnabled: boolean;
  }>(`system/config`);

  return response.data;
};
