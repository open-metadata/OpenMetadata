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

export const FileSearch02: FC<Props> = ({
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
      d="M10.8 9.2H6m1.6 3.2H6M12.4 6H6m9.6 2.8V5.84c0-1.344 0-2.016-.26-2.53a2.4 2.4 0 0 0-1.05-1.048C13.777 2 13.105 2 11.76 2H6.64c-1.343 0-2.015 0-2.529.262A2.4 2.4 0 0 0 3.062 3.31c-.261.514-.261 1.186-.261 2.53v8.32c0 1.344 0 2.016.261 2.53a2.4 2.4 0 0 0 1.05 1.048C4.624 18 5.296 18 6.64 18H8.8m8.4 0L16 16.8m.8-2a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FileSearch02.displayName = 'FileSearch02';
