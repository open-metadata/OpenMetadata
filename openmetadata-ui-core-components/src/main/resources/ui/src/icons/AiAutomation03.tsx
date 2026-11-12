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

export const AiAutomation03: FC<Props> = ({
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
      d="m11.933 9.559-.356-.618a1.095 1.095 0 0 0-1.493-.403 1.09 1.09 0 0 1-1.493-.388 1.05 1.05 0 0 1-.147-.524A1.095 1.095 0 0 0 7.35 6.5h-.718a1.09 1.09 0 0 0-1.09 1.095 1.095 1.095 0 0 1-1.094 1.079 1.05 1.05 0 0 1-.524-.147 1.095 1.095 0 0 0-1.493.403l-.382.629a1.095 1.095 0 0 0 .398 1.493 1.095 1.095 0 0 1 0 1.896 1.09 1.09 0 0 0-.398 1.488l.361.623a1.095 1.095 0 0 0 1.493.424 1.085 1.085 0 0 1 1.488.398c.094.16.144.34.146.524 0 .605.49 1.095 1.095 1.095h.718c.602 0 1.092-.487 1.094-1.09a1.09 1.09 0 0 1 1.095-1.094c.184.005.364.055.524.146.522.301 1.19.123 1.493-.398l.377-.628a1.09 1.09 0 0 0-.398-1.493 1.09 1.09 0 0 1 0-1.891c.518-.303.695-.966.398-1.488z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.502 12a1.509 1.509 0 1 1-3.018 0 1.509 1.509 0 0 1 3.018 0m6.096-9.5.589 1.532c.141.367.212.55.321.704q.147.206.353.354c.155.11.338.18.704.32l1.533.59-1.532.59c-.367.14-.55.21-.705.32a1.5 1.5 0 0 0-.353.354c-.11.154-.18.337-.321.704l-.59 1.532-.589-1.532c-.14-.367-.211-.55-.32-.704a1.5 1.5 0 0 0-.354-.354c-.154-.11-.338-.18-.704-.32L11.098 6l1.532-.59c.366-.14.55-.21.704-.32q.206-.148.353-.354c.11-.154.18-.337.321-.704z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiAutomation03.displayName = 'AiAutomation03';
