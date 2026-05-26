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

import { useLocation } from 'react-router-dom';
import { useAppMode } from '../../hooks/useAppMode';
import { useAppModeRegistry } from '../../hooks/useAppModeRegistry';
import { isNewLayoutRoute } from '../../utils/LayoutUtils';
import LeftSidebar from '../MyData/LeftSidebar/LeftSidebar.component';
import Sidebar from '../Sidebar/Sidebar.component';

const AppSidebar = () => {
  const { pathname } = useLocation();
  const appMode = useAppMode();
  // If a non-default mode is registered with a sidebar, that wins over
  // path-based selection so the active mode's chrome persists across
  // unrelated routes too.
  const ModeSidebar = useAppModeRegistry(
    (state) => state.modes[appMode]?.sidebar
  );

  if (ModeSidebar) {
    return <ModeSidebar />;
  }

  if (isNewLayoutRoute(pathname)) {
    return <Sidebar />;
  }

  return <LeftSidebar />;
};

export default AppSidebar;
