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
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { useIsTextClamped } from '../../../../../hooks/useIsTextClamped';

export interface ClampedTextProps {
  /** The full text, shown in a tooltip when the clamp hides part of it. */
  text: string;
  className?: string;
  /** The rendered text; may carry links, so it is not the tooltip itself. */
  children: ReactNode;
}

/**
 * Text clamped to two lines, with the full text in a tooltip only when the
 * clamp actually cuts it off.
 *
 * Not Typography's `ellipsis`: that wraps its content in a button, which the
 * detail title cannot sit in because it holds a link. `Focusable` instead
 * takes the tooltip's hover context without a press handler or a tab stop, so
 * the link and the row's own click keep working. Keyboard and screen-reader
 * users already get the whole text, since the clamp only hides it visually.
 */
const ClampedText: React.FC<ClampedTextProps> = ({
  text,
  className,
  children,
}) => {
  const { ref, isClamped } = useIsTextClamped<HTMLSpanElement>(text);

  return (
    <Tooltip isDisabled={!isClamped} placement="bottom start" title={text}>
      <Focusable excludeFromTabOrder>
        <span
          className={classNames(
            'tw:line-clamp-2 tw:break-words tw:text-left',
            className
          )}
          data-testid="clamped-text"
          ref={ref}>
          {children}
        </span>
      </Focusable>
    </Tooltip>
  );
};

export default ClampedText;
