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
import {
  CompositeDrawerConfig,
  useCompositeDrawer,
} from './useCompositeDrawer';

type Api = ReturnType<typeof useCompositeDrawer>;

const renderComposite = (config: Partial<CompositeDrawerConfig> = {}) => {
  let api: Api | null = null;
  const Tree = () => {
    api = useCompositeDrawer({
      defaultOpen: true,
      testId: 'composite-drawer',
      header: { title: 'Title' },
      body: { children: <div data-testid="body" /> },
      footer: {
        secondaryButton: {
          label: 'Cancel',
          testId: 'cancel-btn',
          onClick: () => api?.closeDrawer(),
        },
        primaryButton: {
          label: 'Save',
          testId: 'save-btn',
          onClick: jest.fn(),
        },
      },
      ...config,
    } as CompositeDrawerConfig);

    return (
      <>
        <button data-testid="prog-close" onClick={() => api?.closeDrawer()} />
        {api?.compositeDrawer}
      </>
    );
  };
  render(<Tree />);

  return () => api as Api;
};

const closeIcon = () => screen.getByRole('button', { name: /close/i });

describe('useCompositeDrawer onBeforeClose', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls onBeforeClose once when the header close button is clicked', () => {
    const onBeforeClose = jest.fn();
    renderComposite({ onBeforeClose });

    fireEvent.click(closeIcon());

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
  });

  it('calls onBeforeClose once when Escape dismisses the drawer', () => {
    const onBeforeClose = jest.fn();
    renderComposite({ onBeforeClose });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
  });

  it('calls onBeforeClose once on a programmatic closeDrawer()', () => {
    const onBeforeClose = jest.fn();
    renderComposite({ onBeforeClose });

    fireEvent.click(screen.getByTestId('prog-close'));

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
  });

  it('runs onBeforeClose once for the custom header.onClose branch and does not double-fire', () => {
    const onBeforeClose = jest.fn();
    const customClose = jest.fn();
    renderComposite({
      onBeforeClose,
      header: { title: 'Title', onClose: customClose },
    });

    fireEvent.click(closeIcon());

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(customClose).toHaveBeenCalledTimes(1);
    // The custom path bypasses baseDrawer.closeDrawer, so the drawer stays
    // open (the custom handler owns closing).
    expect(screen.getByTestId('composite-drawer')).toBeInTheDocument();
  });
});
