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

export const Ldap: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M12.083 15a2.082 2.082 0 1 1-4.164.002A2.082 2.082 0 0 1 12.083 15ZM8.571 2.917h2.858c1.728 0 1.904.77 1.904 2.083s-.176 2.083-1.904 2.083H8.571c-1.728 0-1.904-.77-1.904-2.083s.176-2.083 1.904-2.083Z"
      fill="#4E5BA6"
      stroke="#4E5BA6"
    />
    <path
      d="M3.333 12.083c.207-1.352 1.038-1.666 3.323-1.666h6.69c2.286 0 3.114.314 3.321 1.666"
      stroke="#4E5BA6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1.667 13.75c0-.786 0-1.178.244-1.423.244-.244.637-.244 1.422-.244.786 0 1.179 0 1.423.244.244.245.244.637.244 1.423s0 1.179-.244 1.423-.637.244-1.423.244c-.785 0-1.178 0-1.422-.244s-.244-.637-.244-1.423Zm13.333 0c0-.786 0-1.178.244-1.423.244-.244.637-.244 1.423-.244.785 0 1.178 0 1.422.244.244.245.244.637.244 1.423s0 1.179-.244 1.423-.637.244-1.422.244c-.786 0-1.179 0-1.423-.244S15 14.536 15 13.75Z"
      fill="#4E5BA6"
      stroke="#4E5BA6"
    />
    <path
      d="M10 7.083v5.834"
      stroke="#4E5BA6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
Ldap.displayName = 'Ldap';
