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

export const ActivityCustomPropertyUpdated: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <g stroke="currentColor">
      <path d="M8.154 2.192c-.295 0-.443 0-.578-.05l-.055-.023c-.13-.06-.235-.164-.444-.373-.48-.481-.721-.722-1.017-.744a1 1 0 0 0-.12 0c-.296.022-.536.263-1.017.744-.209.209-.314.313-.444.373l-.055.023c-.135.05-.283.05-.578.05H3.79c-.754 0-1.13 0-1.365.234-.234.234-.234.611-.234 1.365v.055c0 .295 0 .443-.05.578l-.023.055c-.06.13-.164.235-.373.444-.481.48-.722.721-.744 1.017a1 1 0 0 0 0 .12c.022.296.263.536.744 1.017.209.21.313.314.373.444l.023.055c.05.135.05.283.05.578v.055c0 .754 0 1.13.234 1.365.234.234.611.234 1.365.234h.055c.295 0 .443 0 .578.05l.055.023c.13.06.235.164.444.373.48.481.721.722 1.017.744q.06.005.12 0c.296-.022.536-.263 1.017-.744.21-.209.314-.313.444-.373l.055-.023c.135-.05.283-.05.578-.05h.055c.754 0 1.13 0 1.365-.234.234-.234.234-.611.234-1.365v-.055c0-.295 0-.443.05-.578l.023-.055c.06-.13.164-.235.373-.444.481-.48.722-.721.744-1.017a1 1 0 0 0 0-.12c-.022-.296-.263-.536-.744-1.017-.209-.209-.313-.314-.373-.444l-.023-.055c-.05-.135-.05-.283-.05-.578V3.79c0-.754 0-1.13-.234-1.365-.234-.234-.611-.234-1.365-.234z" />
      <path d="M7.75 6a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z" />
    </g>
  </svg>
);
ActivityCustomPropertyUpdated.displayName = 'ActivityCustomPropertyUpdated';
