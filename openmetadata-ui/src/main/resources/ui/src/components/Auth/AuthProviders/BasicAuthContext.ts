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
import { createContext, useContext } from 'react';
import { PasswordResetRequest } from '../../../generated/auth/passwordResetRequest';
import { RegistrationRequest } from '../../../generated/auth/registrationRequest';

// Context and hook live in their own module so consumers (SignInPage,
// BasicSignupPage, etc.) that STATICALLY import `useBasicAuth` share the
// same context identity as `BasicAuthProvider` — which is `React.lazy()`'d
// via `LazyBasicAuthProviderWrapper`. If the provider file also owned the
// context, Rollup's chunking could produce two module instances (one in
// the eager graph, one in the lazy chunk), each with its own
// `createContext()` object — the provider populates one, the hook reads
// the other, and every consumer sees the stub default.

export interface BasicAuthContextValue {
  handleLogin: (email: string, password: string) => void;
  handleRegister: (payload: RegistrationRequest) => void;
  handleForgotPassword: (email: string) => Promise<void>;
  handleResetPassword: (payload: PasswordResetRequest) => Promise<void>;
  handleLogout: () => void;
}

const stub = (): never => {
  throw new Error('You forgot to wrap your component in <BasicAuthProvider>.');
};

export const initialBasicAuthContext: BasicAuthContextValue = {
  handleLogin: stub,
  handleRegister: stub,
  handleForgotPassword: stub,
  handleResetPassword: stub,
  handleLogout: stub,
};

export const BasicAuthContext = createContext<BasicAuthContextValue>(
  initialBasicAuthContext
);

export const useBasicAuth = (): BasicAuthContextValue =>
  useContext(BasicAuthContext);
