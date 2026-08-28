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

/**
 * Anything that handles its own activation. A click landing inside one of these belongs to that
 * control, not to whatever clickable surface it happens to sit on.
 */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="tab"]',
  '[contenteditable="true"]',
].join(',');

/**
 * Enter/Space activation for an element that has to behave as a button but cannot be one — a
 * third-party component that only renders a `span`, for instance.
 *
 * Pair it with `role="button"` and `tabIndex={0}`. Without all three the element is invisible both
 * to keyboard users and to `isInteractiveTarget`, so a clickable ancestor swallows its click.
 */
export const activateOnEnterOrSpace = (event: {
  key: string;
  currentTarget: { click: () => void };
  preventDefault: () => void;
}): void => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.currentTarget.click();
  }
};

/**
 * True when the event landed on, or inside, a control that handles its own activation.
 *
 * `boundary` is the element carrying the guard. It exists to reject the one false positive that
 * matters: the clickable surface being protected is itself often a control — a card rendered as
 * `role="button"` — and an unbounded lookup walks straight up into it, making every pixel inside
 * count as interactive and quietly restoring the blanket behaviour this replaced.
 *
 * The rule is "the match must not enclose the boundary", NOT "the match must sit inside it".
 * Those differ for portals: an overlay's content (an antd Popover, a Modal) is a React-tree
 * descendant — so its clicks bubble through this guard — while living in `document.body` in the
 * DOM. A containment test rejects those, and the click escapes to the surface underneath; that is
 * how tag links inside the "+n more" popover kept opening the service card behind them.
 */
export const isInteractiveTarget = (
  target: EventTarget | null,
  boundary?: EventTarget | null
): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  const control = target.closest(INTERACTIVE_SELECTOR);

  if (!control) {
    return false;
  }

  if (!(boundary instanceof Element)) {
    return true;
  }

  return control !== boundary && !control.contains(boundary);
};

/**
 * Guards a clickable ancestor (a card, a table row) from a nested control's activation — without
 * making the whole subtree inert.
 *
 * Blanket `onClick={(e) => e.stopPropagation()}` on a wrapper is the tempting version and it is
 * wrong: it also swallows clicks on padding, on placeholder text ("No Owners", "--"), and on the
 * gaps between chips, so the surrounding row or card silently stops responding in those spots and
 * reads as broken. Only stop what an inner control is actually going to handle.
 */
export const stopPropagationIfInteractive = (event: {
  currentTarget?: EventTarget | null;
  target: EventTarget | null;
  stopPropagation: () => void;
}): void => {
  if (isInteractiveTarget(event.target, event.currentTarget)) {
    event.stopPropagation();
  }
};
