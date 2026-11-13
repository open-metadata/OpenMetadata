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

export const InstallSampleData: FC<Props> = ({
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
      d="M2 6.21v5.054c0 3.175 0 4.763.987 5.75C3.973 18 5.56 18 8.737 18h2.526c3.176 0 4.764 0 5.75-.986.987-.987.987-2.575.987-5.75V6.21M3.153 4.37 2 6.21h16l-1.055-1.757c-.718-1.198-1.078-1.797-1.657-2.125C14.708 2 14.01 2 12.613 2H7.435c-1.368 0-2.051 0-2.622.316s-.934.895-1.66 2.054M10 14.2V8.636"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.472 11.934S10.65 14.406 10 14.406c-.652 0-2.473-2.472-2.473-2.472"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
InstallSampleData.displayName = 'InstallSampleData';
