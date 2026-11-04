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

export const DashedBracket: FC<Props> = ({
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
    <g clipPath="url(#a)">
      <path
        d="M17.595 2.959a.65.65 0 1 0 0-1.3zm-14.806-.65v-.65h-.65v.65zm0 15.2h-.65v.65h.65zm14.806.65a.65.65 0 1 0 0-1.3zm0-15.85v-.65h-.74v1.3h.74zm-2.221 0v-.65h-1.48v1.3h1.48zm-2.961 0v-.65h-1.48v1.3h1.48zm-2.961 0v-.65h-1.48v1.3h1.48zm-2.961 0v-.65H5.01v1.3h1.48zm-2.962 0v-.65h-.74v1.3h.74zm-.74 0h-.65v.76h1.3v-.76zm0 2.28h-.65v1.52h1.3v-1.52zm0 3.04h-.65v1.52h1.3v-1.52zm0 3.04h-.65v1.52h1.3v-1.52zm0 3.04h-.65v1.52h1.3v-1.52zm0 3.04h-.65v.76h1.3v-.76zm0 .76v.65h.74v-1.3h-.74zm2.22 0v.65h1.482v-1.3H5.01zm2.962 0v.65h1.48v-1.3h-1.48zm2.961 0v.65h1.48v-1.3h-1.48zm2.961 0v.65h1.481v-1.3h-1.48zm2.962 0v.65h.74v-1.3h-.74z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M2 2h16v16H2z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
DashedBracket.displayName = 'DashedBracket';
