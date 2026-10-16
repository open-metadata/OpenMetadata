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

export const DateTimeType: FC<Props> = ({
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
    <path
      d="M12.707 2v3.11M6.488 2v3.11m3.109 12.436H8.82c-2.932 0-4.397 0-5.308-.911-.91-.91-.91-2.376-.91-5.308V9.773c0-2.931 0-4.397.91-5.308s2.376-.91 5.308-.91h1.554c2.932 0 4.397 0 5.308.91.91.911.91 2.377.91 5.308v.389M2.602 8.219h13.99"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.272 18.002a3.124 3.124 0 1 0 0-6.248 3.124 3.124 0 0 0 0 6.248"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.273 13.313v1.561l1.042.521"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DateTimeType.displayName = 'DateTimeType';
