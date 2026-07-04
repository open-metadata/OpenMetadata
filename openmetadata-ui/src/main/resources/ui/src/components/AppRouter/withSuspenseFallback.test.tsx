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
import { lazy } from 'react';
import { withSuspenseFallback } from './withSuspenseFallback';

describe('withSuspenseFallback', () => {
  const getLazyComponent = () =>
    lazy(
      () =>
        new Promise<{ default: () => JSX.Element }>((resolve) => {
          setTimeout(() => {
            resolve({
              default: () => <div>Loaded component</div>,
            });
          }, 0);
        })
    );

  it('does not render a default loading indicator while the chunk loads', () => {
    const WrappedComponent = withSuspenseFallback(getLazyComponent());

    render(<WrappedComponent />);

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('renders an explicit fallback when the caller provides one', async () => {
    const WrappedComponent = withSuspenseFallback(
      getLazyComponent(),
      <div>Loading active route</div>
    );

    render(<WrappedComponent />);

    expect(screen.getByText('Loading active route')).toBeInTheDocument();
    expect(await screen.findByText('Loaded component')).toBeInTheDocument();
  });
});
