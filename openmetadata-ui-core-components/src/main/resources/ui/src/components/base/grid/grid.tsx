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
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

type Gap = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12";

const GAP_CLASS: Record<Gap, string> = {
  "0": "tw:gap-0",
  "1": "tw:gap-1",
  "2": "tw:gap-2",
  "3": "tw:gap-3",
  "4": "tw:gap-4",
  "5": "tw:gap-5",
  "6": "tw:gap-6",
  "8": "tw:gap-8",
  "10": "tw:gap-10",
  "12": "tw:gap-12",
};

const ROW_GAP_CLASS: Record<Gap, string> = {
  "0": "tw:gap-y-0",
  "1": "tw:gap-y-1",
  "2": "tw:gap-y-2",
  "3": "tw:gap-y-3",
  "4": "tw:gap-y-4",
  "5": "tw:gap-y-5",
  "6": "tw:gap-y-6",
  "8": "tw:gap-y-8",
  "10": "tw:gap-y-10",
  "12": "tw:gap-y-12",
};

const COL_GAP_CLASS: Record<Gap, string> = {
  "0": "tw:gap-x-0",
  "1": "tw:gap-x-1",
  "2": "tw:gap-x-2",
  "3": "tw:gap-x-3",
  "4": "tw:gap-x-4",
  "5": "tw:gap-x-5",
  "6": "tw:gap-x-6",
  "8": "tw:gap-x-8",
  "10": "tw:gap-x-10",
  "12": "tw:gap-x-12",
};

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  rowGap?: Gap;
  colGap?: Gap;
  children?: ReactNode;
}

const GRID_COLUMNS = 24;

export const Grid = ({ gap, rowGap, colGap, className, children, style, ...props }: GridProps) => {
  return (
    <div
      {...props}
      className={cx(
        "tw:grid",
        gap ? GAP_CLASS[gap] : undefined,
        rowGap ? ROW_GAP_CLASS[rowGap] : undefined,
        colGap ? COL_GAP_CLASS[colGap] : undefined,
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

Grid.displayName = "Grid";

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  span?: number;
  start?: number;
  children?: ReactNode;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const GridItem = ({ span = GRID_COLUMNS, start, className, children, style, ...props }: GridItemProps) => {
  const clampedStart = start !== undefined ? clamp(start, 1, GRID_COLUMNS) : undefined;
  const maxSpan = clampedStart !== undefined ? GRID_COLUMNS - clampedStart + 1 : GRID_COLUMNS;
  const clampedSpan = clamp(span, 1, maxSpan);

  const gridColumn =
    clampedStart !== undefined
      ? `${clampedStart} / span ${clampedSpan}`
      : `span ${clampedSpan}`;

  return (
    <div
      {...props}
      className={cx(className)}
      style={{ gridColumn, ...style }}
    >
      {children}
    </div>
  );
};

GridItem.displayName = "Grid.Item";

Grid.Item = GridItem;
