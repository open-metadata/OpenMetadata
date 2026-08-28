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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tooltip } from './tooltip';

// Establish pointer modality so react-aria treats hover as a valid trigger.
// Without a prior mousemove the modality is null and hover events are ignored.
const setupPointerModality = () => fireEvent.mouseMove(document);

// A minimal focusable React component used to test the triggerClassName
// "force wrap" behaviour on component children (not just HTML elements).
const IconStub = ({ className }: { className?: string }) => (
  <svg className={className} data-testid="icon" viewBox="0 0 24 24" />
);

describe('Tooltip — child wrapping', () => {
  it('auto-wraps a non-focusable span in a button so the tooltip can anchor', () => {
    render(
      <Tooltip isOpen title="tip">
        <span>trigger</span>
      </Tooltip>
    );

    expect(screen.getByText('trigger').closest('button')).not.toBeNull();
  });

  it('auto-wraps a div', () => {
    render(
      <Tooltip isOpen title="tip">
        <div>trigger</div>
      </Tooltip>
    );

    expect(screen.getByText('trigger').closest('button')).not.toBeNull();
  });

  it('wraps a native button in an AriaButton so react-aria hover fires reliably', () => {
    render(
      <Tooltip isOpen title="tip">
        <button>trigger</button>
      </Tooltip>
    );

    // 'button' is intentionally excluded from NATIVELY_FOCUSABLE_HTML because
    // react-aria's hover system does not reliably fire on native buttons passed
    // via cloneElement. Wrapping in an AriaButton ensures useHover/usePress attach.
    const buttons = screen.getAllByRole('button', { name: 'trigger' });
    expect(buttons).toHaveLength(2);
    const outer = buttons[0];
    const inner = buttons[1];

    expect(outer.contains(inner)).toBe(true);
  });

  it('does NOT wrap a native anchor', () => {
    render(
      <Tooltip isOpen title="tip">
        <a href="#">trigger</a>
      </Tooltip>
    );

    expect(
      screen.getByRole('link', { name: 'trigger' }).closest('button')
    ).toBeNull();
  });

  it('wraps a React component child when triggerClassName is provided', () => {
    render(
      <Tooltip isOpen title="tip" triggerClassName="custom-cls">
        <IconStub />
      </Tooltip>
    );

    // IconStub is a React component (not a non-focusable string element), so
    // it would normally pass through. triggerClassName forces wrapping.
    const wrapper = screen.getByTestId('icon').closest('button');

    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('custom-cls');
  });

  it('fires onTriggerPress on the generated wrapper', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();

    render(
      <Tooltip title="tip" onTriggerPress={onPress}>
        <span>trigger</span>
      </Tooltip>
    );

    await user.click(screen.getByText('trigger'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('passes triggerIsDisabled to the wrapper button', () => {
    render(
      <Tooltip isOpen triggerIsDisabled title="tip" triggerClassName="">
        <span>trigger</span>
      </Tooltip>
    );

    expect(screen.getByText('trigger').closest('button')).toBeDisabled();
  });
});

describe('Tooltip — show/hide behaviour', () => {
  it('shows the tooltip on hover over an auto-wrapped span child', async () => {
    const user = userEvent.setup();
    setupPointerModality();

    render(
      <Tooltip title="Tooltip text">
        <span>trigger</span>
      </Tooltip>
    );

    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();

    await user.hover(screen.getByText('trigger'));

    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });

  it('shows the tooltip on keyboard focus of an auto-wrapped span child', async () => {
    const user = userEvent.setup();

    render(
      <Tooltip title="Tooltip text">
        <span>trigger</span>
      </Tooltip>
    );

    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });

  it('shows the tooltip on hover over a native button child', async () => {
    const user = userEvent.setup();
    setupPointerModality();

    render(
      <Tooltip title="Tooltip text">
        <button>trigger</button>
      </Tooltip>
    );

    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();

    // Native button is wrapped in AriaButton so useHover fires correctly.
    // Hover over the outer AriaButton (first match).
    const buttons = screen.getAllByRole('button', { name: 'trigger' });
    await user.hover(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });

  it('renders immediately when isOpen is true', () => {
    render(
      <Tooltip isOpen title="Always visible">
        <button>trigger</button>
      </Tooltip>
    );

    expect(screen.getByText('Always visible')).toBeInTheDocument();
  });

  it('does not show tooltip on interaction when trigger is disabled', async () => {
    const user = userEvent.setup();
    setupPointerModality();

    render(
      <Tooltip triggerIsDisabled title="Hidden">
        <span>trigger</span>
      </Tooltip>
    );

    const wrapper = screen.getByText('trigger').closest('button');
    expect(wrapper).toBeDisabled();

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();

    // Try to hover over the disabled trigger — tooltip should not appear
    await user.hover(wrapper!);

    // Give the tooltip time to appear (if it were going to)
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
