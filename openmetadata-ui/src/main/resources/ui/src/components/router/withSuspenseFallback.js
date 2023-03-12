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

import React, { Suspense } from 'react';
import Loader from '../Loader/Loader';

export default function withSuspenseFallback(Component) {
  return function DefaultFallback(props) {
    return (
      <Suspense fallback={<Loader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
