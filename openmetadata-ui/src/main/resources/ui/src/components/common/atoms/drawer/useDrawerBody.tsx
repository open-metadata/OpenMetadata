/*
 *  Copyright 2024 Collate.
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

import { SlideoutMenu } from '@openmetadata/ui-core-components';
import { ReactNode, useMemo } from 'react';
import Loader from '../../Loader/Loader';

export interface DrawerBodyConfig {
  children?: ReactNode;
  loading?: boolean;
  className?: string;
}

export const useDrawerBody = (config: DrawerBodyConfig = {}) => {
  const { children, loading, className } = config;

  const drawerBody = useMemo(
    () => (
      <SlideoutMenu.Content className={className}>
        {loading && <Loader />}
        {children}
      </SlideoutMenu.Content>
    ),
    [children, loading, className]
  );

  return {
    drawerBody,
  };
};
