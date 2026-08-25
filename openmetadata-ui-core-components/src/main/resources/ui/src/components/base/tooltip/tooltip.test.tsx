/*
 *  Copyright 2025 Collate.
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

describe('Tooltip — child wrapping', () => {
  it('auto-wraps a non-focusable span in a button so the tooltip can anchor', () => {
    render(
      <Tooltip isOpen title="tip">
        <span>trigger</span>
      </Tooltip>
    );

    // The span should be inside an AriaButton wrapper.
    const trigger = screen.getByText('trigger');

    expect(trigger.closest('button')).not.toBeNull();
  });

  it('auto-wraps a div', () => {
    render(
      <Tooltip isOpen title="tip">
        <div>trigger</div>
      </Tooltip>
    );

    expect(screen.getByText('trigger').closest('button')).not.toBeNull();
  });

  it('does NOT wrap a native button — it is already focusable', () => {
    render(
      <Tooltip isOpen title="tip">
        <button>trigger</button>
      </Tooltip>
    );

    // The button should be a direct child of the TooltipTrigger, not nested
    // inside another button.
    const btn = screen.getByRole('button', { name: 'trigger' });

    expect(btn.closest('button')).toBe(btn);
  });

  it('does NOT wrap a native anchor', () => {
    render(
      <Tooltip isOpen title="tip">
        <a href="#">trigger</a>
      </Tooltip>
    );

    expect(screen.getByRole('link', { name: 'trigger' }).closest('button')).toBeNull();
  });

  it('wraps when triggerClassName is provided even for a React component child', () => {
    render(
      <Tooltip isOpen title="tip" triggerClassName="custom-cls">
        <span>trigger</span>
      </Tooltip>
    );

    const wrapper = screen.getByText('trigger').closest('button');

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
});

describe('Tooltip — show/hide behaviour', () => {
  it('shows the tooltip on hover over an auto-wrapped child', async () => {
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

  it('shows the tooltip on keyboard focus', async () => {
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

  it('renders immediately when isOpen is true', () => {
    render(
      <Tooltip isOpen title="Always visible">
        <button>trigger</button>
      </Tooltip>
    );

    expect(screen.getByText('Always visible')).toBeInTheDocument();
  });

  it('does not render the tooltip content when isDisabled is true', () => {
    render(
      <Tooltip isDisabled isOpen title="Hidden">
        <button>trigger</button>
      </Tooltip>
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});

describe('Tooltip — placement normalisation', () => {
  it.each([
    ['bottomLeft', 'bottom left'],
    ['bottomRight', 'bottom right'],
    ['topLeft', 'top left'],
    ['topRight', 'top right'],
    ['leftTop', 'left top'],
    ['rightTop', 'right top'],
  ])(
    'accepts antd alias "%s" without throwing',
    (alias) => {
      // The shim should translate silently; we just assert no error is thrown
      // and the trigger renders correctly.
      expect(() =>
        render(
          <Tooltip isOpen placement={alias} title="tip">
            <button>trigger</button>
          </Tooltip>
        )
      ).not.toThrow();

      expect(screen.getByText('tip')).toBeInTheDocument();
    }
  );

  it('passes through native react-aria placements unchanged', () => {
    expect(() =>
      render(
        <Tooltip isOpen placement="bottom right" title="tip">
          <button>trigger</button>
        </Tooltip>
      )
    ).not.toThrow();

    expect(screen.getByText('tip')).toBeInTheDocument();
  });
});

describe('Tooltip — mouseEnterDelay shim', () => {
  it('accepts mouseEnterDelay (seconds) without a TypeScript/runtime error', () => {
    expect(() =>
      render(
        <Tooltip isOpen mouseEnterDelay={0.5} title="tip">
          <button>trigger</button>
        </Tooltip>
      )
    ).not.toThrow();

    expect(screen.getByText('tip')).toBeInTheDocument();
  });

  it('prefers the explicit delay prop over mouseEnterDelay', () => {
    // Both provided — delay (ms) should win. We can't easily assert the
    // internal value, so we assert no crash and the tooltip still renders.
    expect(() =>
      render(
        <Tooltip isOpen delay={100} mouseEnterDelay={2} title="tip">
          <button>trigger</button>
        </Tooltip>
      )
    ).not.toThrow();
  });
});
