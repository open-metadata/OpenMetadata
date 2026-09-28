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
import { EntityType } from '../../../enums/entity.enum';
import type { WidgetConfig } from '../../../interface/customization.interface';
import commonWidgetClassBase from '../../../utils/CommonWidget/CommonWidgetClassBase';
import {
  COMMON_WIDGET_REGISTRY,
  REGISTERED_WIDGET_KEYS,
} from './CommonWidgets.registry';
import { resolveWidgetKey } from './CommonWidgets.utils';

interface CommonWidgetsProps {
  widgetConfig: WidgetConfig;
  entityType: EntityType;
  showTaskHandler?: boolean;
}

/**
 * Dispatcher for the shared per-entity right-rail widgets.
 *
 * Every widget key is registered as its own component in
 * `CommonWidgets.registry` — hooks, memos and closures for a widget only
 * initialise when that widget is the one being rendered, so a Description
 * widget instance can never re-render because a Glossary widget's tag
 * confirmation state changed, and widgetConfig for one key cannot leak into
 * another (each renderer owns its own config).
 *
 * Anything not registered falls through to the extension-point registry
 * (`commonWidgetClassBase`) so downstream apps can still contribute widgets.
 */
export const CommonWidgets = ({
  widgetConfig,
  entityType,
  showTaskHandler = true,
}: CommonWidgetsProps) => {
  const widgetKey = resolveWidgetKey(widgetConfig.i, REGISTERED_WIDGET_KEYS);
  const RegisteredWidget = widgetKey
    ? COMMON_WIDGET_REGISTRY[widgetKey]
    : undefined;

  if (RegisteredWidget) {
    return (
      <RegisteredWidget
        entityType={entityType}
        showTaskHandler={showTaskHandler}
        widgetConfig={widgetConfig}
      />
    );
  }

  const FallbackWidget =
    commonWidgetClassBase.getCommonWidgetsFromConfig(widgetConfig);

  return FallbackWidget ? <FallbackWidget /> : null;
};
