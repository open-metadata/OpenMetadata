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

export const NoTier: FC<Props> = ({
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
      d="m7.806 5.668-1.115.515c-1.717.794-2.576 1.19-2.576 1.842 0 .651.859 1.048 2.576 1.842l1.115.515c1.08.5 1.62.75 2.195.75s1.115-.25 2.195-.75l1.115-.515c1.717-.794 2.576-1.19 2.576-1.842"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.748 10.871a.7.7 0 0 1 .139.415c0 .642-.859 1.033-2.576 1.815l-1.115.508c-1.08.492-1.62.739-2.195.739s-1.115-.247-2.195-.739l-1.115-.508c-1.717-.782-2.576-1.173-2.576-1.815 0-.15.046-.285.139-.415"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.479 14.25c.272.216.408.432.408.688 0 .642-.859 1.033-2.576 1.815l-1.115.508c-1.08.493-1.62.739-2.195.739s-1.115-.246-2.195-.739l-1.115-.508c-1.717-.782-2.576-1.173-2.576-1.815 0-.256.136-.472.408-.688m5.864-5.71v-.663c0-.638 0-.957.046-1.223.255-1.47 1.518-2.621 3.128-2.854.292-.042.908-.042 1.607-.042"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.129 2c.355.346 1.757 1.265 1.757 1.757 0 .493-1.402 1.412-1.757 1.758"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
NoTier.displayName = 'NoTier';
