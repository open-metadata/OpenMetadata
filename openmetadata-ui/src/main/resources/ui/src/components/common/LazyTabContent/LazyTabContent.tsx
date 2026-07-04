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

import { ReactNode, Suspense } from 'react';
import { EntityTabs } from '../../../enums/entity.enum';
import Loader from '../Loader/Loader';

interface LazyTabContentProps {
  activeTab: EntityTabs;
  children: ReactNode;
  fallback?: ReactNode;
  tab: EntityTabs;
}

export const LazyTabContent = ({
  activeTab,
  children,
  fallback = (
    <div className="flex-center" data-testid="active-tab-loader">
      <Loader />
    </div>
  ),
  tab,
}: LazyTabContentProps) => {
  // Keep inactive lazy tabs unmounted so their chunks cannot flash fallback UI.
  if (activeTab !== tab) {
    return null;
  }

  return <Suspense fallback={fallback}>{children}</Suspense>;
};
