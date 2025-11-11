/*
 *  Copyright 2024 Collate.
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
import React, { useEffect, useRef, useState } from 'react';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import './generic-tab.less';

interface DynamicHeightWidgetProps {
  widget: WidgetConfig;
  children: React.ReactNode;
  onHeightChange?: (widgetId: string, height: number) => void;
}

export const DynamicHeightWidget = ({
  widget,
  children,
  onHeightChange,
}: DynamicHeightWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(widget.h);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height / 100; // Convert to grid units (100px per unit)
        if (newHeight !== height) {
          setHeight(newHeight);
          onHeightChange?.(widget.i, newHeight);
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [widget.i, height, onHeightChange]);

  return (
    <div className="dynamic-height-widget" ref={containerRef}>
      {children}
    </div>
  );
};
