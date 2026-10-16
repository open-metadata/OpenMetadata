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
import { act } from 'react';

// Both drawers are boundaries here: the real ones pull permissions, airflow
// status and the whole test-case form stack.
jest.mock('../../DataQuality/BundleSuiteForm/BundleSuiteFormDrawer', () => ({
  __esModule: true,
  default: ({ open }: { open?: boolean }) => (
    <div data-open={String(open)} data-testid="bundle-suite-drawer" />
  ),
}));

jest.mock(
  '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer',
  () => ({
    __esModule: true,
    default: ({ open }: { open?: boolean }) => (
      <div data-open={String(open)} data-testid="test-case-drawer" />
    ),
  })
);

// The layout re-claims its intent listeners when its kept-alive route becomes
// visible again; the callback is captured so that path can be driven directly.
let routeActivationCallback: (() => void) | undefined;

jest.mock('../../platform/ai-shell/context/useRouteActivation', () => ({
  useRouteActivation: (onActivate: () => void) => {
    routeActivationCallback = onActivate;
  },
}));

import { Intent } from '../../platform/ai-shell/AppModule.types';
import { emitIntent, useIntent } from '../../platform/ai-shell/useIntent';
import ObservabilityLayout from './ObservabilityLayout';

const IntentProbe = ({ handler }: { handler: () => void }) => {
  useIntent(Intent.AddTestCase, handler);

  return null;
};

const renderLayout = () =>
  render(
    <ObservabilityLayout>
      <div data-testid="child-content">Test Content</div>
    </ObservabilityLayout>
  );

describe('ObservabilityLayout', () => {
  it('renders children', () => {
    renderLayout();

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('does not create a nested page scrollbar', () => {
    renderLayout();

    expect(screen.getByTestId('observability-layout')).toHaveClass(
      'tw:min-h-full'
    );
    expect(screen.getByTestId('observability-layout')).not.toHaveClass(
      'tw:overflow-auto'
    );
  });

  it('keeps both drawers closed until an intent arrives', () => {
    renderLayout();

    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
  });

  it('opens the test-case drawer on the add-test-case intent', () => {
    renderLayout();

    act(() => {
      emitIntent(Intent.AddTestCase);
    });

    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
  });

  it('opens the bundle-suite drawer on the add-bundle-suite intent', () => {
    renderLayout();

    act(() => {
      emitIntent(Intent.AddBundleSuite);
    });

    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('re-claims its intent listeners when the kept-alive route reactivates', () => {
    renderLayout();

    // A second host clobbers the single listener slot and frees it on unmount.
    const other = jest.fn();
    const { unmount } = render(<IntentProbe handler={other} />);
    unmount();

    act(() => {
      routeActivationCallback?.();
    });
    act(() => {
      emitIntent(Intent.AddTestCase);
    });

    expect(other).not.toHaveBeenCalled();
    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
  });
});
