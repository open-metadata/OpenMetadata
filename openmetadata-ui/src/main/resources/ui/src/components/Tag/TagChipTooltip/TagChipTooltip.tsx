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

import { Tooltip } from '@openmetadata/ui-core-components';
import { ReactNode, useState } from 'react';
import { useFocusWithin } from 'react-aria';
import { Focusable } from 'react-aria-components';

/**
 * Anchors a chip's tooltip on a wrapper kept out of the tab order, so the chip
 * is one tab stop, its link. The tooltip opens on hover, and when focus reaches
 * the link inside: the wrapper itself is never focused.
 */
export const TagChipTooltip = ({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { focusWithinProps } = useFocusWithin({
    onFocusWithinChange: setIsOpen,
  });

  return (
    <Tooltip
      arrow
      delay={500}
      isOpen={isOpen}
      placement="top"
      title={title}
      onOpenChange={setIsOpen}>
      <Focusable excludeFromTabOrder>
        <span className="tw:inline-flex" {...focusWithinProps}>
          {children}
        </span>
      </Focusable>
    </Tooltip>
  );
};
