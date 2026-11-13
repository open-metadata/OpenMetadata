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

export const Schema03: FC<Props> = ({
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
      d="M12.95 10.2a2.65 2.65 0 1 1-5.3 0 2.65 2.65 0 0 1 5.3 0Zm4.449-6.298a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0ZM5.2 6.1a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Zm.424 8.652a.775.775 0 1 1-1.55 0 .775.775 0 0 1 1.55 0ZM17.4 15.7a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0ZM5.326 6.836l3 2m-.276 3.117-2.6 2.3m9.6-9.3-3.046 3.354m.045 3.646 2.5 2.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Schema03.displayName = 'Schema03';
