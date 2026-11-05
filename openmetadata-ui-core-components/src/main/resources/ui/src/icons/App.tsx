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

export const App: FC<Props> = ({
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
      d="M18.002 14.802a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0M2 14.801c0-1.232 0-1.848.277-2.3.156-.254.369-.467.622-.622.452-.277 1.069-.277 2.3-.277 1.233 0 1.85 0 2.302.277.253.155.466.368.621.621.278.453.278 1.07.278 2.301 0 1.233 0 1.849-.278 2.301a1.9 1.9 0 0 1-.621.622C7.048 18 6.432 18 5.2 18s-1.849 0-2.301-.277a1.9 1.9 0 0 1-.622-.622C2 16.65 2 16.034 2 14.802M2 5.2c0-1.232 0-1.849.277-2.301.156-.253.369-.466.622-.622C3.35 2 3.968 2 5.199 2c1.233 0 1.85 0 2.302.277.253.156.466.369.621.622.278.452.278 1.069.278 2.3 0 1.233 0 1.85-.278 2.302a1.9 1.9 0 0 1-.621.621C7.048 8.4 6.432 8.4 5.2 8.4s-1.849 0-2.301-.278a1.9 1.9 0 0 1-.622-.621C2 7.048 2 6.432 2 5.2m9.602 0c0-1.232 0-1.849.277-2.301.155-.253.368-.466.621-.622C12.953 2 13.57 2 14.801 2c1.233 0 1.849 0 2.301.277.254.156.467.369.622.622.277.452.277 1.069.277 2.3 0 1.233 0 1.85-.277 2.302a1.9 1.9 0 0 1-.622.621c-.452.278-1.068.278-2.3.278-1.233 0-1.85 0-2.302-.278a1.9 1.9 0 0 1-.621-.621c-.277-.453-.277-1.069-.277-2.301"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
App.displayName = 'App';
