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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ActivityTagsUpdated: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M17.82 9.824c.18-.436.18-.92.18-1.889V5.16c0-1.489 0-2.234-.463-2.696C17.075 2 16.33 2 14.841 2h-2.776c-.969 0-1.453 0-1.889.18s-.778.523-1.462 1.208L4.37 7.732C2.79 9.312 2 10.102 2 11.083c0 .982.79 1.771 2.37 3.351l1.196 1.197C7.146 17.21 7.936 18 8.916 18"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.2 5.601h.2m-.4 0a.4.4 0 1 0 .8 0 .4.4 0 0 0-.8 0M12.156 17.01l-1.554.31.31-1.553a1.63 1.63 0 0 1 .446-.834l3.638-3.638a.815.815 0 0 1 1.153 0l.478.478a.815.815 0 0 1 0 1.153l-3.638 3.638a1.63 1.63 0 0 1-.833.446Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityTagsUpdated.displayName = 'ActivityTagsUpdated';
