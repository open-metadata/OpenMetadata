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

import {
  activateOnEnterOrSpace,
  isInteractiveTarget,
  stopPropagationIfInteractive,
} from './InteractiveTargetUtils';

const elementFrom = (html: string): Element => {
  const host = document.createElement('div');
  host.innerHTML = html;

  return host.firstElementChild as Element;
};

describe('isInteractiveTarget', () => {
  it.each([
    ['a link', '<a href="/tag/PII">PII</a>'],
    ['a button', '<button type="button">Edit</button>'],
    ['an input', '<input />'],
    ['a select', '<select></select>'],
    ['a textarea', '<textarea></textarea>'],
    ['an ARIA button', '<div role="button">Edit</div>'],
    ['an ARIA link', '<span role="link">Open</span>'],
    ['a menu item', '<div role="menuitem">Delete</div>'],
    ['a checkbox', '<div role="checkbox"></div>'],
    ['a switch', '<div role="switch"></div>'],
    ['a tab', '<div role="tab">Overview</div>'],
    ['an editable region', '<div contenteditable="true">text</div>'],
  ])('treats %s as interactive', (_, html) => {
    expect(isInteractiveTarget(elementFrom(html))).toBe(true);
  });

  it.each([
    ['plain text', '<span>No Owners</span>'],
    ['a layout wrapper', '<div class="tags-container"></div>'],
    ['an image', '<img alt="logo" />'],
    // A link without an href is not a control — it activates nothing.
    ['an anchor with no href', '<a>Not a link</a>'],
  ])('treats %s as inert', (_, html) => {
    expect(isInteractiveTarget(elementFrom(html))).toBe(false);
  });

  it('counts a descendant of a control as part of that control', () => {
    const link = elementFrom('<a href="/tag/PII"><span>PII</span></a>');

    expect(isInteractiveTarget(link.querySelector('span'))).toBe(true);
  });

  // The clickable surface being guarded is itself often role="button". Without a boundary the
  // lookup walks straight past the wrapper, matches that surface, and every pixel inside counts as
  // interactive — silently restoring the blanket behaviour the helper exists to replace.
  it('ignores a control that encloses the boundary rather than sitting inside it', () => {
    const card = elementFrom(
      '<div role="button"><div id="guard"><span id="label">No Owners</span></div></div>'
    );
    const guard = card.querySelector('#guard');

    expect(isInteractiveTarget(card.querySelector('#label'))).toBe(true);
    expect(isInteractiveTarget(card.querySelector('#label'), guard)).toBe(
      false
    );
  });

  it('still sees a control nested inside the boundary', () => {
    const card = elementFrom(
      '<div role="button"><div id="guard"><a href="/users/alice">alice</a></div></div>'
    );

    expect(
      isInteractiveTarget(card.querySelector('a'), card.querySelector('#guard'))
    ).toBe(true);
  });

  // Overlay content (antd Popover, Modal) is a React-tree descendant — its clicks bubble through
  // the guard — but a DOM sibling in `document.body`. Requiring DOM containment rejected it, and
  // the click carried on to the card underneath: tag links inside "+n more" opened the service.
  it('sees a control that only descends from the boundary through a portal', () => {
    const guard = elementFrom('<div id="guard"></div>');
    const portaled = elementFrom('<a href="/tag/PII">PII</a>');

    expect(guard.contains(portaled)).toBe(false);
    expect(isInteractiveTarget(portaled, guard)).toBe(true);
  });

  it('does not treat the boundary itself as an inner control', () => {
    const guard = elementFrom('<button id="guard"><span>Edit</span></button>');

    expect(isInteractiveTarget(guard.querySelector('span'), guard)).toBe(false);
  });

  it('is false for a non-element target', () => {
    expect(isInteractiveTarget(null)).toBe(false);
    expect(isInteractiveTarget(document.createTextNode('text'))).toBe(false);
  });
});

describe('stopPropagationIfInteractive', () => {
  // The point of the helper: a blanket stopPropagation makes padding, placeholder text and the
  // gaps between chips inert, so the clickable row or card around them looks broken.
  it('lets a click on inert content reach the surface underneath', () => {
    const stopPropagation = jest.fn();

    stopPropagationIfInteractive({
      stopPropagation,
      target: elementFrom('<span>No Owners</span>'),
    });

    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('keeps a click on a control to itself', () => {
    const stopPropagation = jest.fn();

    stopPropagationIfInteractive({
      stopPropagation,
      target: elementFrom('<a href="/users/alice">alice</a>'),
    });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});

describe('activateOnEnterOrSpace', () => {
  const eventFor = (key: string) => ({
    click: jest.fn(),
    key,
    preventDefault: jest.fn(),
  });

  it.each(['Enter', ' '])('activates on %s', (key) => {
    const spies = eventFor(key);

    activateOnEnterOrSpace({
      currentTarget: { click: spies.click },
      key: spies.key,
      preventDefault: spies.preventDefault,
    });

    expect(spies.click).toHaveBeenCalledTimes(1);
    // Space would otherwise scroll the page out from under the control it just activated.
    expect(spies.preventDefault).toHaveBeenCalledTimes(1);
  });

  it.each(['Tab', 'a', 'ArrowDown', 'Escape'])('leaves %s alone', (key) => {
    const spies = eventFor(key);

    activateOnEnterOrSpace({
      currentTarget: { click: spies.click },
      key: spies.key,
      preventDefault: spies.preventDefault,
    });

    expect(spies.click).not.toHaveBeenCalled();
    expect(spies.preventDefault).not.toHaveBeenCalled();
  });
});
