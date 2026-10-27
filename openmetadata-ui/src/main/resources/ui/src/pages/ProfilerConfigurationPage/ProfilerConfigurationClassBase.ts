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
import { ComponentType } from 'react';

export interface SparkAgentConfigProps {
  /**
   * How a delete is confirmed. The settings modal confirms in an anchored
   * popover (ADR:2026-10-27-settings-modal-confirms-in-anchored-popovers);
   * the legacy page keeps its modal.
   */
  confirmation?: 'modal' | 'popover';
}

class ProfilerConfigurationClassBase {
  public getSparkAgentConfigComponent():
    | ComponentType<SparkAgentConfigProps>
    | undefined {
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
