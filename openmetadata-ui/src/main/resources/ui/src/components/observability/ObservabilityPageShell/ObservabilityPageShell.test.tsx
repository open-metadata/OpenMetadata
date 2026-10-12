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
import ObservabilityPageShell from './ObservabilityPageShell';

jest.mock('../../common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => null)
);

describe('ObservabilityPageShell', () => {
  it('uses one outer inset without adding horizontal header padding', () => {
    render(
      <ObservabilityPageShell
        data-testid="observability-page"
        header={<div>Header</div>}
        pageTitle="Observability">
        Content
      </ObservabilityPageShell>
    );

    expect(screen.getByTestId('observability-page')).toHaveClass('tw:p-2');
    expect(screen.getByTestId('observability-page-header')).not.toHaveClass(
      'tw:px-4'
    );
  });
});
