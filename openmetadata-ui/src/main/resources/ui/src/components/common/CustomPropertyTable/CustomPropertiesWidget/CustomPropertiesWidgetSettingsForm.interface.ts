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
import { ReactNode } from 'react';
import {
  CustomPropertiesWidgetSettings,
  CustomPropertiesWidgetStyle,
} from './CustomPropertiesWidget.interface';

export type StepState = 'disabled' | 'active' | 'done';

export interface SettingsStepProps {
  step: number;
  state: StepState;
  title: string;
  description: string;
  children: ReactNode;
}

export interface CustomPropertiesWidgetSettingsFormProps {
  entityType?: string;
  /** Unset until a new widget's style is picked; the property step waits for it. */
  style?: CustomPropertiesWidgetStyle;
  value: CustomPropertiesWidgetSettings;
  onStyleChange: (style: CustomPropertiesWidgetStyle) => void;
  onChange: (value: CustomPropertiesWidgetSettings) => void;
}
