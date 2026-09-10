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

import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import { useTranslation } from 'react-i18next';
import { App } from '../../../../generated/entity/applications/app';
import { PipelineStatus } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EntityReference } from '../../../../generated/entity/type';
import applicationsClassBase from './ApplicationsClassBase';

export interface DataInsightLatestRun {
  data_insight_task: string;
  application_task: string;
  total: string;
  pipelineStatus: PipelineStatus;
}

export enum AppAction {
  ENABLE = 'enable',
  DISABLE = 'disable',
  UNINSTALL = 'uninstall',
}

export type TFunc = ReturnType<typeof useTranslation>['t'];

export interface ManageButtonHandlers {
  setShowActions: (value: boolean) => void;
  setAction: (value: AppAction) => void;
  setShowDeleteModel: (value: boolean) => void;
}

export interface ConfigurationTabParams {
  showMcpConfigTab: boolean;
  showAppConfigTab: boolean;
  appData: App | undefined;
  jsonSchema: RJSFSchema | undefined;
  isSaveLoading: boolean;
  onConfigSave: (
    data: IChangeEvent & { ingestionRunner?: EntityReference }
  ) => Promise<void>;
  ApplicationConfigurationComponent: ReturnType<
    typeof applicationsClassBase.getApplicationConfigurationComponent
  >;
  t: TFunc;
}

export interface ScheduleTabParams {
  showScheduleTab: boolean;
  appData: App | undefined;
  isRuntimeDisabled: boolean;
  runtimeDisabledReason: string | undefined;
  jsonSchema: RJSFSchema | undefined;
  isRunLoading: boolean;
  isDeployLoading: boolean;
  onDemandTrigger: () => Promise<void>;
  onDeployTrigger: () => Promise<void>;
  onAppScheduleSave: (cron: string) => Promise<void>;
  t: TFunc;
}

export interface RecentRunsTabParams {
  isAppUnavailable: boolean;
  showScheduleTab: boolean;
  appData: App | undefined;
  jsonSchema: RJSFSchema | undefined;
  t: TFunc;
}

export interface LiveIndexingTabParams {
  isAppUnavailable: boolean;
  appData: App | undefined;
  t: TFunc;
}
