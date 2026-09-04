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
import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

export interface AvatarStackProps {
  /**
   * Each element is one avatar slot. The stack adds overlap + a white gap
   * outline around each item so stacked avatars appear visually separated.
   */
  items: ReactNode[];
  /** Items beyond this count collapse into the overflow slot. */
  maxCount?: number;
  /** Avatar pixel size — controls overlap amount and overflow chip dimensions. Default 24. */
  avatarSize?: number;
  className?: string;
  /**
   * Custom element rendered in the overflow slot (e.g. a popover trigger).
   * When provided, replaces the built-in +N chip. The stack still wraps it
   * with the same gap-outline so it blends visually.
   */
  overflowChip?: ReactNode;
  /** Called when the built-in +N overflow chip is clicked. Ignored when overflowChip is set. */
  onOverflowClick?: () => void;
}

export const AvatarStack = ({
  items,
  maxCount,
  avatarSize = 24,
  className,
  overflowChip,
  onOverflowClick,
}: AvatarStackProps) => {
  const visibleItems = maxCount != null ? items.slice(0, maxCount) : items;
  const overflowCount =
    maxCount != null ? Math.max(0, items.length - maxCount) : 0;
  const overlapPx = Math.round(avatarSize / 4);
  // Font size scales with avatar size: 10px for ≤20 px avatars, 12px otherwise.
  const overflowFontSize = avatarSize <= 20 ? 10 : 12;

  return (
    <div className={cx('tw:flex tw:items-center', className)}>
      {visibleItems.map((item, i) => (
        <div
          // Index key is safe here — the list order is stable within a stack.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="tw:relative tw:shrink-0 tw:rounded-full"
          style={{
            height: avatarSize,
            marginLeft: i > 0 ? `-${overlapPx}px` : undefined,
            width: avatarSize,
            zIndex: i + 1,
          }}>
          {item}
        </div>
      ))}
      {overflowCount > 0 && (
        <div
          className="tw:relative tw:shrink-0 tw:rounded-full tw:flex tw:items-center tw:justify-center"
          style={{
            height: avatarSize,
            marginLeft: `-${overlapPx}px`,
            width: avatarSize,
            zIndex: visibleItems.length + 1,
          }}>
          {overflowChip ?? (
            <button
              aria-label={`+${overflowCount} more`}
              className="tw:cursor-pointer tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0"
              type="button"
              onClick={onOverflowClick}>
              <div
                className="tw:flex tw:items-center tw:justify-center tw:rounded-full tw:bg-secondary tw:font-semibold tw:text-tertiary"
                style={{
                  fontSize: overflowFontSize,
                  height: avatarSize,
                  width: avatarSize,
                }}>
                {`+${overflowCount}`}
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
