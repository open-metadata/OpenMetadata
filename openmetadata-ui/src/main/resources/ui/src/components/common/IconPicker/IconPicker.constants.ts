/*
 *  Copyright 2024 Collate.
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

import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Cube01,
  Database01,
  Globe01,
  Grid01,
  Home02,
  Menu01,
  Plus,
  SearchLg,
  Tag01,
  Trash01,
  Users01,
  XClose,
} from '@untitledui/icons';
import { IconDefinition } from './IconPicker.interface';

export const DEFAULT_ICON = 'Cube01';

export const AVAILABLE_ICONS: IconDefinition[] = [
  { name: 'Cube01', component: Cube01, category: 'default' },
  { name: 'Home02', component: Home02, category: 'icons' },
  { name: 'Database01', component: Database01, category: 'icons' },
  { name: 'Globe01', component: Globe01, category: 'icons' },
  { name: 'Users01', component: Users01, category: 'icons' },
  { name: 'Tag01', component: Tag01, category: 'icons' },
  { name: 'SearchLg', component: SearchLg, category: 'icons' },
  { name: 'Grid01', component: Grid01, category: 'icons' },
  { name: 'Menu01', component: Menu01, category: 'icons' },
  { name: 'Plus', component: Plus, category: 'icons' },
  { name: 'Trash01', component: Trash01, category: 'icons' },
  { name: 'ChevronRight', component: ChevronRight, category: 'icons' },
  { name: 'ArrowLeft', component: ArrowLeft, category: 'icons' },
  { name: 'ArrowRight', component: ArrowRight, category: 'icons' },
  { name: 'XClose', component: XClose, category: 'icons' },
];
