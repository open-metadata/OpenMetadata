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

export const TicketCheck: FC<Props> = ({
  size = 20,
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
    <mask height={16} id="a" maskUnits="userSpaceOnUse" width={12} x={4} y={2}>
      <path d="M16 2H4.001v16h11.997z" fill="#fff" />
    </mask>
    <g mask="url(#a)">
      <mask fill="#fff" id="b">
        <path d="M12.645 2.578c-.368 0-.656.307-.778.654a1.981 1.981 0 0 1-3.737 0c-.122-.347-.41-.654-.778-.654H6.027c-.8 0-1.449.65-1.449 1.45v11.941c0 .8.65 1.45 1.45 1.45h1.324c.368 0 .656-.307.778-.655a1.981 1.981 0 0 1 3.737 0c.122.348.41.655.778.655h1.324c.8 0 1.45-.65 1.45-1.45V4.027c0-.8-.65-1.449-1.45-1.449z" />
      </mask>
      <path
        d="M12.645 2.578c-.368 0-.656.307-.778.654a1.981 1.981 0 0 1-3.737 0c-.122-.347-.41-.654-.778-.654H6.027c-.8 0-1.449.65-1.449 1.45v11.941c0 .8.65 1.45 1.45 1.45h1.324c.368 0 .656-.307.778-.655a1.981 1.981 0 0 1 3.737 0c.122.348.41.655.778.655h1.324c.8 0 1.45-.65 1.45-1.45V4.027c0-.8-.65-1.449-1.45-1.449z"
        mask="url(#b)"
        stroke="currentColor"
        strokeWidth={2.6}
      />
      <path
        d="m8.336 10.023.942 1.225a.2.2 0 0 0 .3.02l2.602-2.6"
        stroke="currentColor"
        strokeWidth={1.3}
      />
    </g>
  </svg>
);
TicketCheck.displayName = 'TicketCheck';
