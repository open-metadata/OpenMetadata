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
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOntologyStudioDrawerHost } from './OntologyStudioDrawer.context';

interface OntologyStudioDrawerProps {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly placement?: 'beside' | 'overlay';
  readonly testId?: string;
}

// 600px is the design width; narrower screens keep the 420px the canvas could always spare.
const PANEL_CLASS =
  'tw:flex tw:w-105 tw:2xl:w-150 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-overlay-surface tw:shadow-xl';

/**
 * The Studio's right slide-over. `beside` (the default) sits next to the canvas, which
 * narrows, so every node and row stays clickable while a panel is open. `overlay` floats
 * over the canvas area below the header, for lists with nothing to click underneath.
 */
const OntologyStudioDrawer = ({
  ariaLabel,
  children,
  className,
  placement = 'beside',
  testId,
}: OntologyStudioDrawerProps) => {
  const host = useOntologyStudioDrawerHost();

  if (placement === 'beside') {
    return (
      <aside
        aria-label={ariaLabel}
        className={classNames(
          PANEL_CLASS,
          'tw:relative tw:z-30 tw:my-2 tw:mr-2 tw:max-w-[55%] tw:shrink-0',
          className
        )}
        data-testid={testId}>
        {children}
      </aside>
    );
  }

  return createPortal(
    <aside
      aria-label={ariaLabel}
      className={classNames(
        PANEL_CLASS,
        host
          ? 'tw:absolute tw:top-2 tw:right-2 tw:bottom-2 tw:z-30 tw:max-w-[calc(100%-1rem)]'
          : 'tw:fixed tw:top-1.5 tw:right-1.5 tw:bottom-1.5 tw:z-40 tw:max-w-[calc(100vw-0.75rem)]',
        className
      )}
      data-testid={testId}>
      {children}
    </aside>,
    host ?? document.body
  );
};

export default OntologyStudioDrawer;
