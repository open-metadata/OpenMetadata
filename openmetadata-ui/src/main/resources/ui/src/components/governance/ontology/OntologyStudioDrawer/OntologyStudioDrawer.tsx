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
import { ReactNode, useState } from 'react';
import { UNSAFE_PortalProvider as PortalProvider } from 'react-aria';
import { createPortal } from 'react-dom';
import { useOntologyStudioDrawerHost } from './OntologyStudioDrawer.context';

interface OntologyStudioDrawerProps {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  /** A confirm dialog scoped to this drawer: its scrim and card cover only the panel, per the design. */
  readonly confirm?: ReactNode;
  readonly placement?: 'beside' | 'overlay';
  readonly testId?: string;
}

// 40% of the screen, as the design's drawer; never narrower than the 420px its forms need.
const PANEL_WIDTH = 'tw:w-[40vw] tw:min-w-105';
// transform-gpu makes the panel the containing block of a fixed modal portalled into it.
const PANEL_CLASS = `${PANEL_WIDTH} tw:transform-gpu tw:flex tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-overlay-surface tw:shadow-xl`;
// Full height of the Studio, over the right of the header too; nothing behind it is dimmed.
const HOSTED_CLASS =
  'tw:absolute tw:top-2 tw:right-2 tw:bottom-2 tw:z-40 tw:max-w-[calc(100%-1rem)]';

/**
 * The Studio's right drawer, per the design: full height, over the header, no backdrop.
 * `beside` (the default) also leaves a same-width gap in the canvas row, so the canvas
 * narrows and no node ends up under the drawer. `overlay` covers the area below it, for
 * lists where nothing underneath needs clicking.
 */
const OntologyStudioDrawer = ({
  ariaLabel,
  children,
  className,
  confirm,
  placement = 'beside',
  testId,
}: OntologyStudioDrawerProps) => {
  const host = useOntologyStudioDrawerHost();
  // State, not a ref: the confirm needs the panel mounted before it can portal into it.
  const [panelElement, setPanelElement] = useState<HTMLElement | null>(null);
  // data-studio-drawer: the Studio's canvas toolbar reads it to stay clear of an open drawer.
  const panel = (positionClass: string) => (
    <aside
      data-studio-drawer
      aria-label={ariaLabel}
      className={classNames(PANEL_CLASS, positionClass, className)}
      data-testid={testId}
      ref={setPanelElement}>
      {children}
      {confirm && panelElement ? (
        <PortalProvider getContainer={() => panelElement}>
          {confirm}
        </PortalProvider>
      ) : null}
    </aside>
  );

  // Outside the Studio shell (e.g. a component test) the panel simply sits in the flow.
  if (!host) {
    return placement === 'beside'
      ? panel('tw:relative tw:z-30 tw:my-2 tw:mr-2 tw:max-w-[55%] tw:shrink-0')
      : createPortal(
          panel(
            'tw:fixed tw:top-1.5 tw:right-1.5 tw:bottom-1.5 tw:z-40 tw:max-w-[calc(100vw-0.75rem)]'
          ),
          document.body
        );
  }

  return (
    <>
      {placement === 'beside' ? (
        <div
          aria-hidden
          className={classNames(PANEL_WIDTH, 'tw:my-2 tw:mr-2 tw:shrink-0')}
          data-testid="ontology-studio-drawer-gap"
        />
      ) : null}
      {createPortal(panel(HOSTED_CLASS), host)}
    </>
  );
};

export default OntologyStudioDrawer;
