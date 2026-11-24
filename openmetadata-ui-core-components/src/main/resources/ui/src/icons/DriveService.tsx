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

export const DriveService: FC<Props> = ({
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
      d="M14.727 15.408v-5.185M9.15 3.187h-.697c-2.628 0-3.943 0-4.76.868s-.816 2.264-.816 5.057v6.296"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.135 12.816H5.468a2.592 2.592 0 1 0 0 5.185h6.665a2.592 2.592 0 1 0 0-5.185M5.836 6.148h1.481M5.836 9.113h1.481"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.856 15.408h-.093m.185 0a.185.185 0 1 1-.37 0 .185.185 0 0 1 .37 0m2.495-12.26a1.913 1.913 0 1 1 0 3.827m1.662-2.863 1.017-.581m-1.017 2.48 1.017.581m-2.68-3.444a1.913 1.913 0 1 0 0 3.827m0 0v1.148m-1.66-4.011-1.018-.581m1.017 2.48-1.017.581m2.679-3.444V2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DriveService.displayName = 'DriveService';
