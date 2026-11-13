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
import classNames from 'classnames';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOntologyDraftGuard } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useOntologyStudioDrawerHost } from './OntologyStudioDrawer.context';

interface OntologyStudioDrawerProps {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly testId?: string;
  /**
   * A press anywhere outside the panel closes it, as on the app's other drawers, after the
   * discard prompt when a form in it has unsaved edits. Its own menus, lists, dialogs and
   * toasts are portalled elsewhere, so presses in them don't count.
   */
  readonly onInteractOutside?: () => void;
}

// Overlays a drawer opens portal out of it; a press inside one is still a press in the drawer.
const OWNED_OVERLAY_SELECTOR = [
  '[data-react-aria-top-layer]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="tooltip"]',
  '.Toastify',
].join(',');

// 40% of the screen, as the design's drawer; never narrower than the 420px its forms need.
// ADR:2026-11-12-ontology-studio-drawers-are-40vw-with-a-420px-floor
const PANEL_WIDTH = 'tw:w-[40vw] tw:min-w-105';
// transform-gpu makes the panel the containing block of a fixed modal portalled into it.
const PANEL_CLASS = `${PANEL_WIDTH} tw:transform-gpu tw:flex tw:flex-col tw:overflow-hidden tw:border-l tw:border-secondary tw:bg-overlay-surface tw:shadow-xl`;
// Edge to edge, top to bottom, like the app's other drawers; it covers the canvas, which keeps its layout.
const HOSTED_CLASS = 'tw:fixed tw:inset-y-0 tw:right-0 tw:z-40 tw:max-w-full';

/**
 * The Studio's right drawer, per the design: full height, over the header and the canvas,
 * no backdrop. It is portalled into the Studio shell so the canvas toolbar can see it.
 */
const OntologyStudioDrawer = ({
  ariaLabel,
  children,
  className,
  testId,
  onInteractOutside,
}: OntologyStudioDrawerProps) => {
  const host = useOntologyStudioDrawerHost();
  // A drawer with unsaved edits asks to discard them rather than closing on a stray click.
  const guard = useOntologyDraftGuard();
  // State, not a ref: the outside-press listener needs the mounted panel.
  const [panelElement, setPanelElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!onInteractOutside || !panelElement) {
      return;
    }
    // Capture phase: a tab or button pressed outside acts on pointer down, after the drawer closes.
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !panelElement.contains(target) &&
        !target.closest(OWNED_OVERLAY_SELECTOR)
      ) {
        guard(onInteractOutside);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress, true);

    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePress, true);
  }, [guard, onInteractOutside, panelElement]);
  // data-studio-drawer: the Studio's canvas toolbar reads it to stay clear of an open drawer.
  const panel = (positionClass: string) => (
    <aside
      data-studio-drawer
      aria-label={ariaLabel}
      className={classNames(PANEL_CLASS, positionClass, className)}
      data-testid={testId}
      ref={setPanelElement}>
      {children}
    </aside>
  );

  // Outside the Studio shell (e.g. a component test) the panel simply sits in the flow.
  if (!host) {
    return panel('tw:relative tw:z-30 tw:max-w-[55%] tw:shrink-0');
  }

  return createPortal(panel(HOSTED_CLASS), host);
};

export default OntologyStudioDrawer;
