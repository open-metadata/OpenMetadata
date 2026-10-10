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

export const AutomatedTag: FC<Props> = ({
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
      d="M15.337 7.835c.348-.391.948-.982.916-1.223.024-.234-.102-.454-.356-.894l-.357-.62c-.27-.47-.406-.704-.636-.797s-.49-.02-1.01.127l-.884.25c-.332.076-.68.033-.984-.123l-.244-.141a1.45 1.45 0 0 1-.57-.701l-.243-.722c-.159-.479-.238-.718-.427-.854C10.352 2 10.1 2 9.598 2h-.807c-.503 0-.755 0-.944.137-.19.136-.269.375-.428.854l-.242.722c-.11.289-.31.534-.57.7l-.245.142a1.44 1.44 0 0 1-.984.122l-.883-.249c-.52-.147-.78-.221-1.01-.127-.23.093-.366.328-.636.797l-.358.62c-.253.44-.38.66-.355.894.024.234.194.423.533.8l.747.835c.183.231.312.634.312.996s-.13.765-.312.996l-.747.835c-.339.377-.509.566-.533.8s.102.454.355.894l.358.62c.27.47.405.704.635.798.23.093.49.02 1.01-.128l.884-.249c.333-.077.681-.033.985.123l.243.14c.26.167.46.413.571.701l.242.723c.16.478.247.726.392.831.043.031.217.174.643.16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.94 7.394c-.608-.496-1.086-.687-1.782-.687-1.303.017-2.494 1.094-2.494 2.495 0 .771.235 1.26.678 1.773m7.467-1.233h1.432c.768 0 1.153 0 1.391.239.24.239.24.623.24 1.391v1.433c0 .5 0 .75-.094.974-.093.225-.27.402-.623.755l-2.241 2.242c-.816.815-1.223 1.222-1.73 1.222s-.913-.407-1.728-1.222l-.618-.618c-.815-.815-1.222-1.222-1.222-1.729 0-.506.407-.914 1.222-1.729l2.242-2.242c.353-.353.53-.53.754-.623.225-.093.475-.093.975-.093"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.91 11.6h.102m-.206 0a.206.206 0 1 0 .413 0 .206.206 0 0 0-.413 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AutomatedTag.displayName = 'AutomatedTag';
