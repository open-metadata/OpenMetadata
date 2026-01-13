/*
 *  Copyright 2022 Collate.
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

import { FC } from 'react';
import Loader from '../components/common/Loader/Loader';

export interface LoaderProps {
  isLoading?: boolean;
  size?: 'small' | 'default' | 'x-small';
}

export function withLoader<T>(Component: FC<T>) {
  const WithLoader: FC<T & LoaderProps> = ({ isLoading, size, ...props }) => {
    return isLoading ? (
      <Loader size={size ?? 'default'} />
    ) : (
      <Component {...(props as T & JSX.IntrinsicAttributes)} />
    );
  };

  WithLoader.displayName =
    Component.displayName || Component.name || 'Component';

  return WithLoader;
}
