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

export const Automations: FC<Props> = ({
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
      d="M17.95 10.839a7.994 7.994 0 0 1-14.873 3.157l-.235-.407m-.792-4.43a7.994 7.994 0 0 1 14.873-3.157l.235.407M2 15.704l.637-2.376a.2.2 0 0 1 .245-.142l2.376.637m9.484-7.648 2.376.637a.2.2 0 0 0 .245-.142L18 4.294"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m13.723 8.044-.199-.344c-.15-.26-.225-.39-.352-.443-.128-.052-.272-.01-.561.071l-.49.139a.8.8 0 0 1-.547-.068l-.135-.079a.8.8 0 0 1-.317-.389l-.134-.4c-.089-.266-.133-.399-.238-.475s-.245-.076-.524-.076h-.448c-.28 0-.419 0-.524.076s-.15.209-.237.474l-.135.401a.8.8 0 0 1-.317.39l-.135.078a.8.8 0 0 1-.546.068l-.49-.139c-.29-.082-.434-.123-.562-.07-.127.051-.202.182-.352.442l-.199.344c-.14.245-.21.367-.197.497s.108.234.296.444l.414.463a.96.96 0 0 1 .174.553.97.97 0 0 1-.174.553l-.414.463c-.188.21-.283.314-.296.444s.056.252.197.496l.199.345c.15.26.225.39.352.443.128.051.272.01.561-.071l.49-.139a.8.8 0 0 1 .547.069l.136.078a.8.8 0 0 1 .316.389l.135.4c.088.266.132.399.237.475s.245.075.524.075h.448c.28 0 .419 0 .524-.075.105-.076.15-.209.238-.474l.134-.401a.8.8 0 0 1 .317-.39l.135-.077a.8.8 0 0 1 .546-.069l.49.139c.29.082.434.122.562.07.127-.051.202-.182.352-.442l.199-.344c.14-.245.211-.367.197-.497s-.107-.234-.296-.444l-.414-.463a.96.96 0 0 1-.174-.553.96.96 0 0 1 .174-.553l.414-.463c.188-.21.283-.314.296-.444s-.056-.252-.197-.497"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.254 10a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0"
      fill="currentColor"
    />
  </svg>
);
Automations.displayName = 'Automations';
