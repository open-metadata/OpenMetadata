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

import { FieldProps } from '@rjsf/utils';
import type { TFunction } from 'i18next';
import type { ComponentType } from 'react';
import type {
  PlatformSettingsFormProps,
  PlatformSettingsPageProps,
} from '../../components/discovery/personal-space/Profile/tabs/platform-settings/PlatformSettings.types';

class ProfilerConfigurationClassBase {
  /** Rendered with no props on the classic settings page. */
  public getSparkAgentConfigComponent():
    | ComponentType<Partial<PlatformSettingsPageProps>>
    | undefined {
    return undefined;
  }

  /**
   * A downstream add/edit sub-page served at
   * `profiler-configuration/edit/<itemId>`; the item id format is the
   * implementer's.
   */
  public getSettingsItemForm():
    | ComponentType<PlatformSettingsFormProps>
    | undefined {
    return undefined;
  }

  public getSettingsItemFormTitle(
    _t: TFunction,
    _itemId: string
  ): string | undefined {
    return undefined;
  }

  public getSparkAgentField():
    | ((props: FieldProps) => JSX.Element)
    | undefined {
    return undefined;
  }
}

const profilerConfigurationClassBase = new ProfilerConfigurationClassBase();

export default profilerConfigurationClassBase;
export { ProfilerConfigurationClassBase };
