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

const DrawerHarness = (
  config: Partial<DrawerConfig> & { defaultOpen?: boolean }
) => {
  const { drawer, openDrawer, closeDrawer } = useDrawer({
    defaultOpen: true,
    children: <div data-testid="drawer-body" />,
    ...config,
  });

  return (
    <>
      <button data-testid="open-btn" onClick={openDrawer} />
      <button data-testid="close-btn" onClick={closeDrawer} />
      {drawer}
    </>
  );
};

describe('useDrawer onBeforeClose', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls onBeforeClose before onClose on programmatic closeDrawer()', () => {
    const calls: string[] = [];
    const onBeforeClose = jest.fn(() => calls.push('before'));
    const onClose = jest.fn(() => calls.push('close'));

    render(<DrawerHarness onBeforeClose={onBeforeClose} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('close-btn'));

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['before', 'close']);
  });

  it('calls onBeforeClose when Escape dismisses the drawer', () => {
    const onBeforeClose = jest.fn();
    const onClose = jest.fn();

    render(<DrawerHarness onBeforeClose={onBeforeClose} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onBeforeClose when opening the drawer', () => {
    const onBeforeClose = jest.fn();
    const onOpen = jest.fn();

    render(
      <DrawerHarness
        defaultOpen={false}
        onBeforeClose={onBeforeClose}
        onOpen={onOpen}
      />
    );

    fireEvent.click(screen.getByTestId('open-btn'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onBeforeClose).not.toHaveBeenCalled();
  });

  it('still calls onClose and does not throw when onBeforeClose is omitted', () => {
    const onClose = jest.fn();

    render(<DrawerHarness onClose={onClose} />);

    fireEvent.click(screen.getByTestId('close-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when closeOnEscape is false', () => {
    const onBeforeClose = jest.fn();
    const onClose = jest.fn();

    render(
      <DrawerHarness
        closeOnEscape={false}
        onBeforeClose={onBeforeClose}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onBeforeClose).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
