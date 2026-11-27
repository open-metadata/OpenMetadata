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

export const Polygon: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M12.975 7.132c0 .616-1.332 1.116-2.976 1.116s-2.976-.5-2.976-1.116S8.356 6.016 10 6.016s2.976.5 2.976 1.116m-.001 2.602c0 .617-1.332 1.116-2.976 1.116s-2.976-.5-2.976-1.116"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.975 7.133v5.208c0 .616-1.332 1.116-2.976 1.116s-2.976-.5-2.976-1.117V7.134m1.489 1.112v.744m0 1.862v.743"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle cx={3.012} cy={10.001} fill="currentColor" r={1.012} />
    <circle cx={16.987} cy={10.001} fill="currentColor" r={1.012} />
    <circle
      cx={6.506}
      cy={3.949}
      fill="currentColor"
      r={1.012}
      transform="rotate(60 6.506 3.95)"
    />
    <circle
      cx={13.495}
      cy={16.055}
      fill="currentColor"
      r={1.012}
      transform="rotate(60 13.495 16.055)"
    />
    <circle
      cx={13.494}
      cy={3.949}
      fill="currentColor"
      r={1.012}
      transform="rotate(120 13.494 3.949)"
    />
    <circle
      cx={6.506}
      cy={16.054}
      fill="currentColor"
      r={1.012}
      transform="rotate(120 6.506 16.054)"
    />
  </svg>
);
Polygon.displayName = 'Polygon';
