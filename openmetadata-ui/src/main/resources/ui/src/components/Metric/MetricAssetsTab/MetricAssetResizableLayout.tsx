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
import { Box, SlideoutMenu } from '@openmetadata/ui-core-components';
import {
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

const DEFAULT_PANEL_WIDTH = 360;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 560;
const PANEL_STEP = 16;
const PANEL_STORAGE_KEY = 'openmetadata.metric-assets.summary-width';
const DESKTOP_QUERY = '(min-width: 1280px)';

const clampPanelWidth = (width: number) =>
  Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));

const readPanelWidth = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_PANEL_WIDTH;
  }
  const storedValue = window.localStorage.getItem(PANEL_STORAGE_KEY);
  if (storedValue === null) {
    return DEFAULT_PANEL_WIDTH;
  }
  const storedWidth = Number(storedValue);

  return Number.isFinite(storedWidth)
    ? clampPanelWidth(storedWidth)
    : DEFAULT_PANEL_WIDTH;
};

const useDesktopMetricAssetsLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  return isDesktop;
};

export interface MetricAssetResizableLayoutProps {
  children: ReactNode;
  isSummaryOpen: boolean;
  resizeLabel: string;
  summary?: ReactNode;
  summaryLabel: string;
  onCloseSummary: () => void;
}

const MetricAssetResizableLayout = ({
  children,
  isSummaryOpen,
  resizeLabel,
  summary,
  summaryLabel,
  onCloseSummary,
}: MetricAssetResizableLayoutProps) => {
  const isDesktop = useDesktopMetricAssetsLayout();
  const [panelWidth, setPanelWidth] = useState(readPanelWidth);
  const [dragStart, setDragStart] = useState<{
    clientX: number;
    width: number;
  }>();

  const updateWidth = useCallback((width: number) => {
    const nextWidth = clampPanelWidth(width);
    setPanelWidth(nextWidth);
    window.localStorage.setItem(PANEL_STORAGE_KEY, String(nextWidth));
  }, []);

  useEffect(() => {
    if (!dragStart) {
      return;
    }
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      setPanelWidth(
        clampPanelWidth(dragStart.width + dragStart.clientX - event.clientX)
      );
    };
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      updateWidth(dragStart.width + dragStart.clientX - event.clientX);
      setDragStart(undefined);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragStart, updateWidth]);

  const handleSeparatorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const widthByKey: Partial<Record<string, number>> = {
      ArrowLeft: panelWidth + PANEL_STEP,
      ArrowRight: panelWidth - PANEL_STEP,
      End: MAX_PANEL_WIDTH,
      Home: MIN_PANEL_WIDTH,
    };
    const nextWidth = widthByKey[event.key];
    if (nextWidth !== undefined) {
      event.preventDefault();
      updateWidth(nextWidth);
    }
  };

  if (!isDesktop) {
    return (
      <>
        {children}
        <SlideoutMenu
          isDismissable
          className="tw:z-50 tw:motion-reduce:transition-none tw:motion-reduce:animate-none"
          dialogClassName="tw:min-w-0 tw:overflow-x-hidden"
          isOpen={isSummaryOpen}
          width="min(100vw, 560px)"
          onOpenChange={(open) => {
            if (!open) {
              onCloseSummary();
            }
          }}>
          {({ close }) => (
            <>
              <SlideoutMenu.Header
                data-testid="metric-asset-summary-drawer-header"
                onClose={() => {
                  close();
                  onCloseSummary();
                }}>
                <span className="tw:font-semibold tw:text-primary">
                  {summaryLabel}
                </span>
              </SlideoutMenu.Header>
              <SlideoutMenu.Content
                className="tw:min-w-0 tw:overflow-x-hidden"
                data-testid="metric-asset-summary-drawer">
                {summary}
              </SlideoutMenu.Content>
            </>
          )}
        </SlideoutMenu>
      </>
    );
  }

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:gap-0"
      style={
        isSummaryOpen
          ? { gridTemplateColumns: `minmax(0, 1fr) 12px ${panelWidth}px` }
          : undefined
      }>
      {children}
      {isSummaryOpen && (
        <>
          <Box
            aria-label={resizeLabel}
            aria-orientation="vertical"
            aria-valuemax={MAX_PANEL_WIDTH}
            aria-valuemin={MIN_PANEL_WIDTH}
            aria-valuenow={panelWidth}
            className="tw:group tw:cursor-col-resize tw:items-stretch tw:justify-center tw:px-1 tw:outline-focus-ring"
            data-testid="metric-asset-summary-resizer"
            role="separator"
            tabIndex={0}
            onKeyDown={handleSeparatorKeyDown}
            onPointerDown={(event: PointerEvent<HTMLDivElement>) =>
              setDragStart({ clientX: event.clientX, width: panelWidth })
            }>
            <span className="tw:w-px tw:bg-border-secondary tw:group-hover:bg-border-brand" />
          </Box>
          {summary}
        </>
      )}
    </Box>
  );
};

export default MetricAssetResizableLayout;
