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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import MetricAssetResizableLayout from './MetricAssetResizableLayout';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, ...props }: { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  SlideoutMenu: Object.assign(
    ({
      children,
      className,
      dialogClassName,
      isOpen,
      onOpenChange,
      width,
    }: {
      children: ReactNode | ((state: { close: () => void }) => ReactNode);
      className?: string;
      dialogClassName?: string;
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
      width?: number | string;
    }) =>
      isOpen ? (
        <div
          className={className}
          data-dialog-class-name={dialogClassName}
          data-testid="mock-slideout"
          data-width={width}>
          {typeof children === 'function'
            ? children({ close: () => onOpenChange(false) })
            : children}
        </div>
      ) : null,
    {
      Content: ({ children, ...props }: { children: ReactNode }) => (
        <div {...props}>{children}</div>
      ),
      Header: ({
        children,
        onClose,
        ...props
      }: {
        children: ReactNode;
        onClose: () => void;
      }) => (
        <div {...props}>
          {children}
          <button
            aria-label="label.close"
            data-testid="mock-slideout-close"
            onClick={onClose}
          />
        </div>
      ),
    }
  ),
}));

const setViewport = (matches: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({
    addEventListener: jest.fn(),
    matches,
    media: '(min-width: 1280px)',
    removeEventListener: jest.fn(),
  });
};

describe('MetricAssetResizableLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('resizes the desktop summary with the keyboard and persists the width', () => {
    setViewport(true);
    render(
      <MetricAssetResizableLayout
        isSummaryOpen
        resizeLabel="Resize summary"
        summary={<aside>summary</aside>}
        summaryLabel="Asset summary"
        onCloseSummary={jest.fn()}>
        <main>assets</main>
      </MetricAssetResizableLayout>
    );

    const separator = screen.getByRole('separator', {
      name: 'Resize summary',
    });

    expect(separator).toHaveAttribute('aria-valuenow', '360');

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });

    expect(separator).toHaveAttribute('aria-valuenow', '376');
    expect(
      window.localStorage.getItem('openmetadata.metric-assets.summary-width')
    ).toBe('376');

    fireEvent.keyDown(separator, { key: 'Home' });

    expect(separator).toHaveAttribute('aria-valuenow', '300');
  });

  it('clamps a persisted width and uses a reduced-motion slideout on narrow screens', () => {
    window.localStorage.setItem(
      'openmetadata.metric-assets.summary-width',
      '999'
    );
    setViewport(true);
    const desktop = render(
      <MetricAssetResizableLayout
        isSummaryOpen
        resizeLabel="Resize summary"
        summary={<aside>summary</aside>}
        summaryLabel="Asset summary"
        onCloseSummary={jest.fn()}>
        <main>assets</main>
      </MetricAssetResizableLayout>
    );

    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '560'
    );

    desktop.unmount();

    setViewport(false);
    const onCloseSummary = jest.fn();
    render(
      <MetricAssetResizableLayout
        isSummaryOpen
        resizeLabel="Resize summary"
        summary={<aside>summary</aside>}
        summaryLabel="Asset summary"
        onCloseSummary={onCloseSummary}>
        <main>assets</main>
      </MetricAssetResizableLayout>
    );

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    const slideout = screen.getByTestId('mock-slideout');

    expect(slideout).toHaveClass(
      'tw:z-50',
      'tw:motion-reduce:transition-none',
      'tw:motion-reduce:animate-none'
    );
    expect(slideout).toHaveAttribute('data-width', 'min(100vw, 560px)');
    expect(slideout).toHaveAttribute(
      'data-dialog-class-name',
      'tw:min-w-0 tw:overflow-x-hidden'
    );
    expect(screen.getByTestId('metric-asset-summary-drawer')).toHaveClass(
      'tw:min-w-0',
      'tw:overflow-x-hidden'
    );

    fireEvent.click(screen.getByTestId('mock-slideout-close'));

    expect(onCloseSummary).toHaveBeenCalled();
  });
});
