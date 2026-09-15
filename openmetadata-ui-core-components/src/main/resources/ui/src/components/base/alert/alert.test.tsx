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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertVariant } from './alert';

describe('Alert theme semantics', () => {
  it.each<[AlertVariant, string, string]>([
    ['success', 'tw:bg-success-primary', 'tw:border-success-subtle'],
    ['warning', 'tw:bg-warning-primary', 'tw:border-warning-subtle'],
    ['error', 'tw:bg-error-primary', 'tw:border-error-subtle'],
  ])(
    'uses semantic surface and border roles for the %s variant',
    (variant, backgroundClass, borderClass) => {
      render(<Alert title={`${variant} alert`} variant={variant} />);

      expect(screen.getByRole('alert')).toHaveClass(
        backgroundClass,
        borderClass
      );
    }
  );
});
