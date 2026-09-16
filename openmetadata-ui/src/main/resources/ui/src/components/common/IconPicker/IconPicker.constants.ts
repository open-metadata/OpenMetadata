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
  Bank,
  BarChart01,
  Browser,
  Calendar,
  ChevronRight,
  CloudLightning,
  Code01,
  CreditCard01,
  Cube01,
  Database01,
  Dataflow04,
  File01,
  FileSearch01,
  Folder,
  Globe01,
  GoogleChrome,
  Grid01,
  Home02,
  Image01,
  Laptop01,
  LayersThree01,
  Link01,
  Lock01,
  Mail01,
  Menu01,
  NavigationPointer01,
  Passport,
  Plus,
  Rss01,
  SearchLg,
  Server05,
  Shield01,
  ShoppingBag01,
  Speaker01,
  Tag01,
  Trash01,
  Upload01,
  UserEdit,
  Users01,
  XClose,
} from '@untitledui/icons';
import { IconDefinition } from './IconPicker.interface';

export const DEFAULT_ICON_NAME = 'Cube01';
export const DEFAULT_DOMAIN_ICON: IconDefinition = {
  name: 'Globe01',
  component: Globe01,
  category: 'default',
};
export const DEFAULT_DATA_PRODUCT_ICON: IconDefinition = {
  name: 'Cube01',
  component: Cube01,
  category: 'default',
};
export const DEFAULT_TAG_ICON: IconDefinition = {
  name: 'LayersThree01',
  component: LayersThree01,
  category: 'default',
};

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
  { name: 'Bank', component: Bank, category: 'icons' },
  { name: 'ShoppingBag01', component: ShoppingBag01, category: 'icons' },
  { name: 'Passport', component: Passport, category: 'icons' },
  { name: 'Speaker01', component: Speaker01, category: 'icons' },
  { name: 'Dataflow04', component: Dataflow04, category: 'icons' },
  { name: 'Image01', component: Image01, category: 'icons' },
  { name: 'Server05', component: Server05, category: 'icons' },
  { name: 'CreditCard01', component: CreditCard01, category: 'icons' },
  { name: 'Laptop01', component: Laptop01, category: 'icons' },
  { name: 'Mail01', component: Mail01, category: 'icons' },
  { name: 'Code01', component: Code01, category: 'icons' },
  { name: 'Shield01', component: Shield01, category: 'icons' },
  { name: 'Lock01', component: Lock01, category: 'icons' },
  { name: 'Folder', component: Folder, category: 'icons' },
  { name: 'FileSearch01', component: FileSearch01, category: 'icons' },
  { name: 'GoogleChrome', component: GoogleChrome, category: 'icons' },
  { name: 'Link01', component: Link01, category: 'icons' },
  { name: 'Upload01', component: Upload01, category: 'icons' },
  { name: 'CloudLightning', component: CloudLightning, category: 'icons' },
  {
    name: 'NavigationPointer01',
    component: NavigationPointer01,
    category: 'icons',
  },
  { name: 'BarChart01', component: BarChart01, category: 'icons' },
  { name: 'File01', component: File01, category: 'icons' },
  { name: 'UserEdit', component: UserEdit, category: 'icons' },
  { name: 'Rss01', component: Rss01, category: 'icons' },
  { name: 'Browser', component: Browser, category: 'icons' },
  { name: 'Calendar', component: Calendar, category: 'icons' },
  { name: 'LayersThree01', component: LayersThree01, category: 'icons' },
];
