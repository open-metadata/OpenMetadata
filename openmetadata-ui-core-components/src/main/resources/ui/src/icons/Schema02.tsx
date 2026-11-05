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

export const Schema02: FC<Props> = ({
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
      d="M12.013 9.938a1.962 1.962 0 1 1-3.923 0 1.962 1.962 0 0 1 3.923 0m5.385-6.6a1.338 1.338 0 1 1-2.677 0 1.338 1.338 0 0 1 2.677 0m-.418 12.61a1.338 1.338 0 1 1-2.677 0 1.338 1.338 0 0 1 2.677 0M5.28 4.362a1.338 1.338 0 1 1-2.676 0 1.338 1.338 0 0 1 2.676 0m.276 12.301a1.338 1.338 0 1 1-2.677 0 1.338 1.338 0 0 1 2.677 0m5.651-8.37 3.934-3.934M5.148 15.621l3.934-3.934m2.35-.207 3.187 3.352m-9.574-9.48 3.177 3.35"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Schema02.displayName = 'Schema02';
