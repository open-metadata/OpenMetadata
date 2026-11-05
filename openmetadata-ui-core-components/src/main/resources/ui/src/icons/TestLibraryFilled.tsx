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

export const TestLibraryFilled: FC<Props> = ({
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
      d="M14.72 7.053V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v9.355a3 3 0 0 0 3 3h4.7"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="M17.37 9.578h-6.317a.63.63 0 0 0-.631.632v1.69a5.54 5.54 0 0 0 2.587 4.688 2.26 2.26 0 0 0 2.405 0A5.54 5.54 0 0 0 18 11.9v-1.69a.63.63 0 0 0-.632-.63Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      className="tw:stroke-bg-primary"
      d="m13 13.143.9.857 2.1-2"
      stroke="#fff"
      strokeWidth={1.2}
    />
    <path
      d="M4.525 7.05h6.737M4.559 9.676h1.717m-1.717 2.562h1.717"
      stroke="currentColor"
      strokeWidth={1.2}
    />
  </svg>
);
TestLibraryFilled.displayName = 'TestLibraryFilled';
