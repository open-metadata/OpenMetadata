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

export const Follow: FC<Props> = ({
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
      d="m11.382 3.155 1.408 2.84c.192.394.704.774 1.136.846l2.551.428c1.632.274 2.016 1.467.84 2.645l-1.983 2c-.336.339-.52.992-.416 1.46l.568 2.476c.448 1.96-.584 2.718-2.304 1.694l-2.392-1.428c-.432-.258-1.144-.258-1.584 0l-2.391 1.428c-1.712 1.024-2.752.258-2.304-1.694l.568-2.476c.104-.468-.08-1.121-.416-1.46l-1.984-2c-1.168-1.178-.792-2.371.84-2.645l2.552-.428c.424-.072.936-.452 1.128-.847l1.407-2.839c.768-1.54 2.016-1.54 2.776 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Follow.displayName = 'Follow';
