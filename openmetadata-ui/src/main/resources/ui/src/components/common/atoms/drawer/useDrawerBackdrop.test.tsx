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
import { fireEvent, render, screen } from '@testing-library/react';
import { DrawerConfig, useDrawer } from './useDrawer';

// react-aria's interact-outside (backdrop) dismissal cannot be driven from
// synthetic events in jsdom (no PointerEvent), so we stub SlideoutMenu and
// expose a backdrop button that calls onOpenChange(false), exactly as the real
// ModalOverlay does on a backdrop click.
jest.mock('@openmetadata/ui-core-components', () => ({
  SlideoutMenu: Object.assign(
    ({
      isOpen,
      onOpenChange,
      children,
      'data-testid': testId,
    }: {
      isOpen: boolean;
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
      'data-testid'?: string;
    }) =>
      isOpen ? (
        <div data-testid={testId}>
          {children}
          <button
            data-testid="slideout-backdrop"
            onClick={() => onOpenChange?.(false)}>
            backdrop
          </button>
        </div>
      ) : null,
    {
      Header: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Content: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
      ),
      Footer: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    }
  ),
}));

const Harness = (config: Partial<DrawerConfig>) => {
  const { drawer, closeDrawer } = useDrawer({ defaultOpen: true, ...config });

  return (
    <>
      <button data-testid="close-btn" onClick={closeDrawer} />
      {drawer}
    </>
  );
};

describe('useDrawer backdrop dismissal', () => {
  it('calls onBeforeClose before onClose when the backdrop requests close', () => {
    const calls: string[] = [];
    const onBeforeClose = jest.fn(() => calls.push('before'));
    const onClose = jest.fn(() => calls.push('close'));

    render(<Harness onBeforeClose={onBeforeClose} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('slideout-backdrop'));

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['before', 'close']);
  });

  it('calls onBeforeClose on programmatic closeDrawer()', () => {
    const onBeforeClose = jest.fn();

    render(<Harness onBeforeClose={onBeforeClose} />);

    fireEvent.click(screen.getByTestId('close-btn'));

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
  });
});
