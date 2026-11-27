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

export const Application: FC<Props> = ({
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
    <rect
      height={14}
      rx={3}
      stroke="currentColor"
      strokeWidth={1.3}
      width={16}
      x={2}
      y={3}
    />
    <path
      d="M4.61 6.084a.61.61 0 0 1-.47-.201.61.61 0 0 1-.202-.472c0-.202.067-.336.201-.47l.068-.068c.067 0 .067-.067.134-.067.068-.068.068-.068.135-.068h.27c.066 0 .066 0 .134.068.067 0 .067.067.134.067l.068.067c.067.068.134.135.134.202.068.067.068.202.068.27 0 .067 0 .201-.068.269 0 .067-.067.134-.134.202a.61.61 0 0 1-.471.201m2.019-.001a.61.61 0 0 1-.471-.202.61.61 0 0 1-.202-.47c0-.068 0-.203.067-.27.068-.067.068-.135.135-.202s.135-.135.202-.135c.27-.134.538-.067.74.135.068.067.135.135.135.202.067.067.067.202.067.27a.61.61 0 0 1-.202.47.61.61 0 0 1-.47.202m2.019.001c-.068 0-.202 0-.27-.067-.067-.067-.134-.067-.202-.134-.067-.068-.134-.135-.134-.202-.067-.068-.067-.202-.067-.27 0-.067 0-.202.067-.269s.067-.134.134-.202a.65.65 0 0 1 .943 0c.067.068.134.135.134.202.068.067.068.202.068.27 0 .067 0 .201-.068.269-.067.067-.067.134-.134.202a.61.61 0 0 1-.471.201"
      fill="currentColor"
    />
    <path
      d="M2.207 7.5h15.575M6.63 10.23l-2.019 2.02 2.02 2.019m6.73-4.039 2.02 2.02-2.02 2.019m-2.018-4.71L8.65 14.943"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Application.displayName = 'Application';
