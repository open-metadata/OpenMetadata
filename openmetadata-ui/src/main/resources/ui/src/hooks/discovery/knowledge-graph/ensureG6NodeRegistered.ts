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

import { ExtensionCategory, register } from '@antv/g6';
import { ReactNode as AntVReactNode } from '@antv/g6-extension-react';

let registered = false;

/**
 * Register the AntV React node with G6 exactly once, at most.
 *
 * G6's extension registry is a module-level singleton. Calling `register`
 * again is a no-op in the happy path, but a module-scope call ran at import
 * time — even in test environments where G6 was mocked but the module still
 * loaded — and forced every consumer to pull in the extension. This helper
 * is deferred to the first render so it can be guarded and tested.
 */
export const ensureG6NodeRegistered = (): void => {
  if (registered) {
    return;
  }
  registered = true;
  register(ExtensionCategory.NODE, 'react-node', AntVReactNode);
};

/**
 * Test-only: reset the guard so the next call to `ensureG6NodeRegistered`
 * registers again. Do not use in production code.
 */
export const resetG6NodeRegistrationForTests = (): void => {
  registered = false;
};
