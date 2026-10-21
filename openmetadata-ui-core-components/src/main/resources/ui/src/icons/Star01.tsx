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

export const Star01: FC<Props> = ({
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
      d="M9.403 2.878c.192-.389.288-.583.418-.646a.42.42 0 0 1 .358 0c.131.063.227.257.418.646L12.42 6.57c.057.115.085.173.127.217a.4.4 0 0 0 .129.095 1 1 0 0 0 .246.053l4.076.596c.429.063.644.094.743.198a.42.42 0 0 1 .111.342c-.019.143-.175.294-.485.597l-2.95 2.872a1 1 0 0 0-.167.188.4.4 0 0 0-.05.153 1 1 0 0 0 .025.25l.696 4.056c.073.428.11.642.042.768a.42.42 0 0 1-.291.211c-.142.027-.333-.075-.718-.277l-3.644-1.917c-.113-.058-.17-.089-.23-.1a.4.4 0 0 0-.16 0c-.06.011-.117.042-.23.1l-3.644 1.917c-.384.203-.577.303-.718.277a.42.42 0 0 1-.29-.211c-.069-.127-.032-.341.042-.768l.695-4.056c.022-.127.033-.19.025-.25a.4.4 0 0 0-.05-.153c-.029-.053-.075-.097-.167-.187l-2.95-2.874c-.311-.302-.467-.453-.485-.597a.42.42 0 0 1 .11-.342c.1-.104.314-.136.743-.198l4.076-.596a1 1 0 0 0 .246-.053.4.4 0 0 0 .129-.094c.042-.045.07-.103.127-.217l1.823-3.692Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Star01.displayName = 'Star01';
