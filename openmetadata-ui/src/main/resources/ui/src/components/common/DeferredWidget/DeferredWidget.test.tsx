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
import { DeferredWidget } from './DeferredWidget.component';

// The repo's setupTests.js stubs window.IntersectionObserver with a no-op constructor whose
// observe() never invokes the callback. That's the exact environment that broke the prior
// revert: without an escape hatch, the children would stay un-mounted forever and any
// child-testid query would hang. The component now mounts eagerly when IO can't observe, OR
// when initialInView is passed — both code paths are exercised below.

describe('<DeferredWidget />', () => {
  it('mounts children immediately when initialInView is set', () => {
    render(
      <DeferredWidget initialInView data-testid="slot">
        <span data-testid="child">visible</span>
      </DeferredWidget>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('exposes the wrapper data-testid so tests can locate the slot before mount', () => {
    render(
      <DeferredWidget data-testid="slot">
        <span data-testid="child">deferred</span>
      </DeferredWidget>
    );

    expect(screen.getByTestId('slot')).toBeInTheDocument();
  });

  it('reserves min-height on the wrapper to prevent layout shift', () => {
    render(
      <DeferredWidget data-testid="slot" minHeight={400}>
        <span>x</span>
      </DeferredWidget>
    );

    expect(screen.getByTestId('slot')).toHaveStyle({ minHeight: '400px' });
  });

  it('falls back to immediate mount when IntersectionObserver is unavailable', () => {
    // Simulate an environment with no IO support — the component's runtime detection should
    // mount children eagerly instead of waiting for a callback that will never come. We patch
    // window.IntersectionObserver to undefined and restore it after the assertion so the
    // global mock from setupTests.js isn't leaked across cases.
    const original = window.IntersectionObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).IntersectionObserver = undefined;

    try {
      render(
        <DeferredWidget data-testid="slot">
          <span data-testid="child">no-io</span>
        </DeferredWidget>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    } finally {
      window.IntersectionObserver = original;
    }
  });
});
