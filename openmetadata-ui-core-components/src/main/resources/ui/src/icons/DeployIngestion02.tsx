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

export const DeployIngestion02: FC<Props> = ({
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
      d="M13.529 4.955c0 1.193-2.581 2.161-5.765 2.161S2 6.148 2 4.955s2.58-2.162 5.764-2.162 5.765.968 5.765 2.162Zm0 5.045c0 1.194-2.581 2.162-5.765 2.162S2 11.194 2 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.529 4.953v10.088c0 1.194-2.581 2.161-5.765 2.161S2 16.235 2 15.041V4.953m2.883 2.164v1.441m0 3.602v1.441m12.576-8.826-.382.382m0 0-1.24 1.239h-1.44m2.68-1.24a.539.539 0 0 1 .382-.922.54.54 0 1 1-.382.923m.382 10.066-.382-.382m0 0-1.24-1.24h-1.44m2.68 1.24a.539.539 0 0 0 .382.922.54.54 0 1 0-.382-.922m.382-4.844h-.54m0 0h-2.523m2.522 0a.54.54 0 1 0 1.081 0 .54.54 0 0 0-1.08 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DeployIngestion02.displayName = 'DeployIngestion02';
