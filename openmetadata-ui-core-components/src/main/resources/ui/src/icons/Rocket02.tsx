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

export const Rocket02: FC<Props> = ({
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
      d="m9.795 12.667-2.462-2.462m2.462 2.462a18.3 18.3 0 0 0 3.282-1.641m-3.282 1.64v4.103s2.486-.451 3.282-1.64c.886-1.33 0-4.103 0-4.103m-5.744-.82a18 18 0 0 1 1.641-3.242A10.57 10.57 0 0 1 18 2c0 2.232-.64 6.154-4.923 9.026m-5.744-.82H3.231s.451-2.487 1.64-3.283c1.33-.886 4.103 0 4.103 0m-5.333 6.975C2.411 14.93 2 18 2 18s3.069-.41 4.103-1.641c.582-.69.574-1.748-.074-2.388a1.79 1.79 0 0 0-2.388-.073"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Rocket02.displayName = 'Rocket02';
