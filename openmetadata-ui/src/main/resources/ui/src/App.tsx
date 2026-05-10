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
  // QueryClientProvider sits OUTSIDE AuthProvider so any query made during the auth flow
  // (e.g. fetching feature flags before login) reuses the same cache. AuthProvider remounts
  // on logout — wrapping QueryClient inside would discard the cache on every logout,
  // which is the opposite of what we want here.
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider childComponentType={AppRouter}>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
