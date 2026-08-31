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
import type { FC, SVGProps } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const QuickLink: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => <svg aria-hidden="true" fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20" width={size} {...props}><path d="M16.26 7.6V5.84c0-1.344 0-2.016-.271-2.53a2.44 2.44 0 0 0-1.087-1.048C14.372 2 13.675 2 12.282 2H6.978c-1.392 0-2.089 0-2.62.262-.468.23-.849.597-1.087 1.048C3 3.824 3 4.496 3 5.84v8.32c0 1.344 0 2.016.271 2.53.238.451.619.818 1.087 1.048.531.262 1.228.262 2.62.262" stroke="currentColor" strokeWidth={1.3} /><circle cx={4.444} cy={4.444} r={4.444} stroke="currentColor" strokeWidth={1.3} transform="matrix(1 0 0 -1 8 18)" /><path d="M11 12h3v3m0-3-3 3M6.031 5.21h4.917M6.031 7.879h1.79" stroke="currentColor" strokeWidth={1.3} /></svg>;
QuickLink.displayName = "QuickLink";