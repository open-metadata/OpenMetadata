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

export const ArchiveFilled: FC<Props> = ({
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
    <g clipPath="url(#a)" strokeWidth={1.3}>
      <path
        d="M16.8 13.068V8.979c0-1.08-.875-1.956-1.955-1.956h-2.051c-.428 0-.845.141-1.185.4l-.642.49a1.925 1.925 0 0 1-2.333 0l-.642-.49c-.34-.259-.757-.4-1.185-.4H4.534c-1.08 0-1.956.876-1.956 1.956v4.089c0 1.08.876 1.955 1.956 1.955h10.31c1.08 0 1.956-.875 1.956-1.955"
        fill="currentColor"
        stroke="currentColor"
      />
      <path d="M3.467 4.355H15.91" stroke="currentColor" />
      <path
        className="tw:stroke-bg-primary"
        d="M8.8 12.356h1.779"
        stroke="#fff"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M2 3.777h16v12.444H2z" fill="#fff" stroke="none" />
      </clipPath>
    </defs>
  </svg>
);
ArchiveFilled.displayName = 'ArchiveFilled';
