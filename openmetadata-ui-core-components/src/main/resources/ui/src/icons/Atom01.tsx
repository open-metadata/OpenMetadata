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

export const Atom01: FC<Props> = ({
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="M12 12h.01m3.525 3.536c-4.686 4.686-10.068 6.902-12.02 4.95-1.953-1.953.263-7.335 4.949-12.021s10.068-6.903 12.02-4.95c1.953 1.952-.263 7.334-4.949 12.02Zm0-7.072c4.686 4.687 6.902 10.069 4.95 12.021-1.953 1.953-7.335-.263-12.021-4.95-4.686-4.686-6.902-10.068-4.95-12.02 1.953-1.953 7.335.263 12.021 4.95ZM12.499 12a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" />
  </svg>
);
Atom01.displayName = 'Atom01';
