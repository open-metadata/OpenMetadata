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

import { QueryClientProvider } from '@tanstack/react-query';
import { FC } from 'react';
import AppRouter from './components/AppRouter/AppRouter';
import { AuthProvider } from './components/Auth/AuthProviders/AuthProvider';
import { queryClient } from './queryClient';

const App: FC = () => {
  // QueryClientProvider sits ABOVE AuthProvider so that the singleton is available everywhere
  // — including AuthProvider's onLogout handler, which needs to clear the query cache so a
  // freshly-authenticated user can't see another principal's cached entity bodies. The
  // QueryClient itself is also exported from `./queryClient` for non-hook callers (axios
  // interceptors, programmatic prefetch, etc.) that can't go through `useQueryClient()`.
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider childComponentType={AppRouter}>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
