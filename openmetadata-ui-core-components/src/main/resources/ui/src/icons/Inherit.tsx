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

export const Inherit: FC<Props> = ({
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
    viewBox="0 0 8 8"
    width={size}
    {...props}>
    <path
      d="M1.6 1.017a.583.583 0 0 0-.583.583v1.733c0 .323.26.584.583.584h.617V4.95c0 .46.373.833.833.833h1.033V6.4c0 .322.261.583.584.583H6.4a.583.583 0 0 0 .583-.583V4.667a.583.583 0 0 0-.583-.584H4.667a.583.583 0 0 0-.584.584v.616H3.05a.333.333 0 0 1-.333-.333V3.917h.616a.583.583 0 0 0 .584-.584V1.6a.583.583 0 0 0-.584-.583zm-.083.583c0-.046.037-.083.083-.083h1.733c.046 0 .084.037.084.083v1.733a.083.083 0 0 1-.084.084H1.6a.083.083 0 0 1-.083-.084zm3.066 3.067c0-.046.038-.084.084-.084H6.4c.046 0 .083.038.083.084V6.4a.083.083 0 0 1-.083.083H4.667a.083.083 0 0 1-.084-.083z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.1}
    />
  </svg>
);
Inherit.displayName = 'Inherit';
