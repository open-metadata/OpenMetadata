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

import React, { PropsWithChildren } from 'react';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';

const AssistantLayout = withSuspenseFallback(
  React.lazy(() => import('./AssistantLayout/AssistantLayout'))
);

/**
 * Outer chrome for app mode — sidebar, top bar, and content slot.
 *
 * Mounted exactly once by `AppModeRoutes` so module routes can stop carrying
 * per-route layout wrapping. Today it is a thin wrapper over `AssistantLayout`;
 * keeping a named indirection here gives future shell-only concerns (header
 * variants, content padding, sticky widgets) a single place to live without
 * re-touching every module file.
 */
export const AppShell = ({ children }: PropsWithChildren) => {
  return <AssistantLayout>{children}</AssistantLayout>;
};

export default AppShell;
