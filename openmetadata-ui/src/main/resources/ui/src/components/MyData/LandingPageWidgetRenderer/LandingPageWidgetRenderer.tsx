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
import { getWidgetFromKey } from '../../../utils/CustomizableLandingPageUtils';
import type { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';

interface LandingPageWidgetRendererProps {
  currentLayout: WidgetConfig[];
  widgetConfig: WidgetConfig;
}

const LandingPageWidgetRenderer = ({
  currentLayout,
  widgetConfig,
}: LandingPageWidgetRendererProps) =>
  getWidgetFromKey({
    widgetConfig,
    currentLayout,
  });

export default LandingPageWidgetRenderer;
