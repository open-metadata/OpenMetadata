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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverCard } from './hover-card';

const renderCard = (props: Partial<Parameters<typeof HoverCard>[0]> = {}) =>
  render(
    <HoverCard content={<a href="/profile">Profile</a>} {...props}>
      <a href="/user">Jane</a>
    </HoverCard>
  );

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('HoverCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Establish pointer modality so react-aria accepts hover events.
    fireEvent.mouseMove(document);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after openDelay on hover and stays open while the pointer is in the card', () => {
    renderCard();
    const trigger = screen.getByText('Jane').parentElement as HTMLElement;

    fireEvent.mouseEnter(trigger, { pointerType: 'mouse' });
    advance(299);

    expect(screen.queryByText('Profile')).toBeNull();

    advance(1);

    expect(screen.getByText('Profile')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(
      screen.getByText('Profile').parentElement as HTMLElement,
      {
        pointerType: 'mouse',
      }
    );
    advance(500);

    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('closes after closeDelay when the pointer leaves', () => {
    renderCard({ openDelay: 0, closeDelay: 200 });
    const trigger = screen.getByText('Jane').parentElement as HTMLElement;

    fireEvent.mouseEnter(trigger, { pointerType: 'mouse' });
    advance(0);
    fireEvent.mouseLeave(trigger, { pointerType: 'mouse' });
    advance(199);

    expect(screen.getByText('Profile')).toBeInTheDocument();

    advance(1);

    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('opens on keyboard focus and closes on Escape', () => {
    renderCard({ openDelay: 0 });

    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => screen.getByText('Jane').focus());
    advance(0);

    expect(screen.getByText('Profile')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('never opens when disabled', () => {
    renderCard({ isDisabled: true, openDelay: 0 });

    fireEvent.mouseEnter(
      screen.getByText('Jane').parentElement as HTMLElement,
      {
        pointerType: 'mouse',
      }
    );
    advance(1000);

    expect(screen.queryByText('Profile')).toBeNull();
  });
});
