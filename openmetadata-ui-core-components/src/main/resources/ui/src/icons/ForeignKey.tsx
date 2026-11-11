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

export const ForeignKey: FC<Props> = ({
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
      d="M15.932 15.036a2.966 2.966 0 0 0-5.685-1.186h-4.62c-.172 0-.258 0-.338.023l-.046.015c-.078.03-.147.081-.284.184l-.652.49a.593.593 0 0 0 0 .948l.652.49c.137.102.206.154.284.184l.046.015c.08.023.166.023.337.023h.201c.243 0 .364 0 .473-.045s.195-.131.366-.302l.37-.37.368.37c.172.171.257.257.366.302.11.045.23.045.473.045h2.004a2.966 2.966 0 0 0 5.685-1.186"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.965 15.183v-.148m0 .296a.297.297 0 1 1 0-.593.297.297 0 0 1 0 .593M4.662 2h3.375v5.034H4.662zm7.219 2.516h3.432V9.55h-3.432zm-.201 2.55H9.896v6.714M6.355 7.145v6.636"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ForeignKey.displayName = 'ForeignKey';
