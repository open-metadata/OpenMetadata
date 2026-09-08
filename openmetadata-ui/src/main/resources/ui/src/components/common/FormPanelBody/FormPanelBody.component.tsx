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
import { FC, ReactNode } from 'react';
import { PanelProps } from '../ResizablePanels/ResizablePanels.interface';
import { FormPanelBodyProps } from './FormPanelBody.interface';

/**
 * Body of the first `ResizablePanels` panel on the service/connection/ingestion form pages.
 *
 * This box limits width and centres itself — it must NOT own the vertical scroll. The panel above it
 * does (`getFormFirstPanelProps` → `allowScroll`), so the wheel works over the blank margins these
 * auto side-margins create on a wide screen. `min-h-full` (not `h-full`) keeps the footer at the
 * panel bottom on a short form while still letting a long form grow and scroll the panel.
 */
const FormPanelBody: FC<FormPanelBodyProps> = ({ children, footer }) => (
  <div className="tw:max-w-screen-lg m-x-auto tw:px-px tw:flex tw:flex-col tw:min-h-full">
    <div className="tw:flex-1">{children}</div>
    {footer && (
      <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:justify-end tw:gap-5 tw:py-4">
        {footer}
      </div>
    )}
  </div>
);

/**
 * `firstPanel` props shared by every page rendering a `FormPanelBody`. `allowScroll` moves the scroll
 * port onto the full-width panel; `no-scrollbar` keeps the scrollbar hidden as it was when the inner
 * body scrolled.
 */
export const getFormFirstPanelProps = (children: ReactNode): PanelProps => ({
  children,
  minWidth: 700,
  flex: 0.7,
  className: 'content-resizable-panel-container no-scrollbar',
  allowScroll: true,
  // Pages render their own card, a built-in AntD card would double it up.
  wrapInCard: false,
});

export default FormPanelBody;
