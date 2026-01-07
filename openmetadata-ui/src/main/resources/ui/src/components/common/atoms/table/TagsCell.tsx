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

import { Box, Chip } from '@mui/material';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TagChip } from '../TagChip';

interface TagsCellProps {
  tags: Array<{
    id?: string;
    name?: string;
    tagFQN?: string;
    displayName?: string;
  }>;
  chipSize?: 'small' | 'large';
}

const TagsCell = ({ tags, chipSize = 'small' }: TagsCellProps) => {
  const [visibleCount, setVisibleCount] = useState(tags.length);
  const [measured, setMeasured] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current || !measureRef.current || measured) {
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const GAP = 8;
    const COUNT_CHIP_WIDTH = 60;

    const chipElements = measureRef.current.querySelectorAll('.measure-chip');
    let accumulatedWidth = 0;
    let fitCount = 0;

    chipElements.forEach((chip, index) => {
      const chipWidth = (chip as HTMLElement).offsetWidth;
      const totalWidth = accumulatedWidth + (index > 0 ? GAP : 0) + chipWidth;

      const remainingTags = tags.length - index - 1;
      const needsCountSpace = remainingTags > 0;
      const maxAllowedWidth = needsCountSpace
        ? containerWidth - COUNT_CHIP_WIDTH - GAP
        : containerWidth;

      if (totalWidth <= maxAllowedWidth) {
        accumulatedWidth = totalWidth;
        fitCount++;
      }
    });

    setVisibleCount(Math.max(1, Math.min(fitCount, 2)));
    setMeasured(true);
  }, [tags, measured]);

  useEffect(() => {
    setMeasured(false);
    setVisibleCount(tags.length);
  }, [tags]);

  const hiddenCount = tags.length - visibleCount;

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        gap: 1,
        width: '100%',
        alignItems: 'center',
        position: 'relative',
        minHeight: chipSize === 'small' ? 24 : 32,
      }}>
      {!measured && (
        <Box
          ref={measureRef}
          sx={{
            display: 'flex',
            gap: 1,
            position: 'absolute',
            visibility: 'hidden',
            top: 0,
            left: 0,
            width: '100%',
          }}>
          {tags.map((tag, index) => (
            <TagChip
              className="measure-chip"
              key={`measure-${tag.id || index}`}
              label={tag.name || tag.tagFQN || ''}
              showEllipsis={false}
              size={chipSize}
              sx={{
                flexShrink: 0,
                '& .MuiChip-label': {
                  whiteSpace: 'nowrap',
                },
              }}
            />
          ))}
        </Box>
      )}

      {measured && (
        <>
          {tags.slice(0, visibleCount).map((tag, index) => {
            const isSingleTag = visibleCount === 1;

            let maxWidth = '200px';
            if (isSingleTag) {
              maxWidth = hiddenCount > 0 ? 'calc(100% - 70px)' : '100%';
            }

            return (
              <TagChip
                key={tag.id || `${tag.tagFQN}-${index}`}
                label={tag.displayName || tag.name || tag.tagFQN || ''}
                maxWidth={maxWidth}
                size={chipSize}
              />
            );
          })}

          {hiddenCount > 0 && (
            <Chip
              color="primary"
              label={`+${hiddenCount}`}
              size={chipSize}
              sx={{
                border: 'none',
                fontWeight: 500,
                flexShrink: 0,
                minWidth: 'auto',
              }}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default TagsCell;
