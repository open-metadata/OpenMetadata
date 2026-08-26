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

export const AddAlert: FC<Props> = ({
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
      d="M13.366 15.05a3.368 3.368 0 0 1-6.737 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.124 1.866a5 5 0 0 0-1.366-.277c-.166-.01-.364-.01-.758-.01s-.591 0-.758.01C6.69 1.755 4.658 3.77 4.49 6.3c-.01.165-.01.36-.01.752v1.1c0 .614 0 .921-.031 1.219a5.86 5.86 0 0 1-.92 2.6c-.164.251-.357.491-.744.97l-.144.18c-.387.478-.58.717-.622.911a.84.84 0 0 0 .452.931c.179.089.488.089 1.106.089h12.846c.618 0 .927 0 1.106-.088a.84.84 0 0 0 .452-.932c-.042-.194-.235-.433-.622-.912l-.144-.178a17 17 0 0 1-.654-.838m-4.034-5.473h5.053m-2.53 2.531V4.109"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AddAlert.displayName = 'AddAlert';
