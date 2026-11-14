/*
 *  Copyright 2023 Collate.
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

interface DomainListCardStyle {
  variant: 'default' | 'elevated' | 'ghost';
  className?: string;
}

// AI mode: tree view stays on the canvas, since its domain details panel is
// styled for it; table and card views sit in a bordered surface card.
export const getDomainListCardStyle = (
  isAiMode: boolean,
  isTreeView: boolean
): DomainListCardStyle => {
  const aiStyle: DomainListCardStyle = isTreeView
    ? { variant: 'ghost', className: 'tw:bg-canvas' }
    : { variant: 'default' };

  return isAiMode ? aiStyle : { variant: 'elevated' };
};
