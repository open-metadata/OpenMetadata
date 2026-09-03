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
import { RJSFSchema } from '@rjsf/utils';
import { App } from '../../../../generated/entity/applications/app';
import {
  isCacheWarmupApplication,
  isMcpApplication,
} from '../../../../utils/ApplicationUtils';
import { TFunc } from './AppDetails.interface';

export const getIsRuntimeDisabled = (appData: App | undefined): boolean =>
  Boolean(appData?.enabled === false && !appData.deleted);

export const getRuntimeDisabledReason = (
  appData: App | undefined,
  isRuntimeDisabled: boolean,
  t: TFunc
): string | undefined =>
  isRuntimeDisabled && isCacheWarmupApplication(appData?.name)
    ? t('message.cache-service-not-configured-message')
    : undefined;

export const getIsAppUnavailable = (
  appData: App | undefined,
  isRuntimeDisabled: boolean
): boolean => Boolean(appData?.deleted) || isRuntimeDisabled;

export const getShowMcpConfigTab = (
  appData: App | undefined,
  isAdminUser: boolean | undefined,
  jsonSchema: RJSFSchema | undefined,
  isRuntimeDisabled: boolean
): boolean =>
  Boolean(
    isMcpApplication(appData?.name) &&
      isAdminUser &&
      jsonSchema &&
      !isRuntimeDisabled
  );

export const getShowAppConfigTab = (
  showMcpConfigTab: boolean,
  appData: App | undefined,
  jsonSchema: RJSFSchema | undefined,
  isRuntimeDisabled: boolean
): boolean =>
  Boolean(
    !showMcpConfigTab &&
      appData?.appConfiguration &&
      appData.allowConfiguration &&
      jsonSchema &&
      !isRuntimeDisabled
  );
