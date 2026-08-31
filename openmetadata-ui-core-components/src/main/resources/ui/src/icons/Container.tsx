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

export const Container: FC<Props> = ({
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
      d="M3.129 4.55H16.87l-1.08 11.682a1.964 1.964 0 0 1-1.963 1.767H6.172a1.963 1.963 0 0 1-1.963-1.767z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2.148 4.552C2.148 3.08 5.682 2 10.001 2c4.32 0 7.853 1.08 7.853 2.552"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Container.displayName = 'Container';
