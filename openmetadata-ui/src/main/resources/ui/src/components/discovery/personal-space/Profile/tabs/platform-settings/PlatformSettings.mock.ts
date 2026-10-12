/*
 *  Copyright 2026 Collate.
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
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../../../../../generated/system/settingsSourceResponse';

/** A setting whose `managedPaths` the deployment configuration owns (ENV mode). */
export const deploymentOwnedSource = (
  configType: SettingType,
  managedPaths: string[]
): SettingSource => ({
  configType,
  source: ConfigSourceMode.Env,
  sourceVariable: 'CONFIG_SOURCE',
  editable: false,
  managedPaths,
});
