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

export const PoliciesDriftFilled: FC<Props> = ({
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
      d="M7.883 2.629H5.765c-1.318 0-1.977 0-2.48.256a2.35 2.35 0 0 0-1.029 1.029C2 4.417 2 5.076 2 6.394v8.158c0 1.318 0 1.977.256 2.48a2.35 2.35 0 0 0 1.029 1.028c.503.257 1.162.257 2.48.257h5.02c1.317 0 1.976 0 2.48-.257a2.35 2.35 0 0 0 1.028-1.028c.257-.503.257-1.162.257-2.48v-.55m-9.413-2.745h3.53M5.137 8.12h2.746m-2.746 6.275h6.275"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.907 11.295a.8.8 0 0 0 .23.108c.057.013.14.013.197 0a.7.7 0 0 0 .23-.108C15.481 10.755 18 9.057 18 6.723V4.45c0-.38 0-.57-.061-.734a.95.95 0 0 0-.258-.375c-.13-.116-.306-.182-.658-.316L14.5 2.068a1 1 0 0 0-.197-.063.5.5 0 0 0-.135 0 1 1 0 0 0-.197.063l-2.523.956c-.352.134-.529.2-.658.316a.95.95 0 0 0-.258.375c-.061.164-.061.354-.061.734v2.274c0 2.334 2.52 4.032 3.436 4.572"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:stroke-bg-primary"
      d="m12.822 6.486.58.585c.197.2.526.2.723 0l1.756-1.774"
      stroke="#fff"
      strokeWidth={1.3}
    />
  </svg>
);
PoliciesDriftFilled.displayName = 'PoliciesDriftFilled';
