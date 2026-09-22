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

export const Settings02: FC<Props> = ({
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
    <path d="m9.395 19.371.585 1.315a2.212 2.212 0 0 0 4.044 0l.584-1.315a2.43 2.43 0 0 1 2.47-1.423l1.43.152a2.212 2.212 0 0 0 2.023-3.502l-.847-1.164a2.43 2.43 0 0 1-.46-1.434c0-.513.163-1.014.464-1.429l.847-1.163a2.211 2.211 0 0 0-2.022-3.502l-1.43.152a2.43 2.43 0 0 1-1.47-.312 2.43 2.43 0 0 1-1-1.117l-.589-1.315a2.212 2.212 0 0 0-4.044 0L9.395 4.63c-.207.468-.557.86-1 1.117-.445.256-.96.365-1.47.312l-1.434-.152a2.212 2.212 0 0 0-2.023 3.502l.847 1.163a2.43 2.43 0 0 1 0 2.858l-.847 1.163a2.21 2.21 0 0 0 .786 3.273c.382.195.811.274 1.237.23l1.43-.153a2.43 2.43 0 0 1 2.474 1.43Z" />
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
  </svg>
);
Settings02.displayName = 'Settings02';
