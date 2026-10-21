/*
 *  Copyright 2026 Collate.
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
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import type { WidgetConfig } from '../../../interface/customization.interface';

// The same cards, in the same order, as an entity page's right panel.
export const RIGHT_PANEL_WIDGETS = [
  DetailPageWidgetKeys.DATA_PRODUCTS,
  DetailPageWidgetKeys.TAGS,
  DetailPageWidgetKeys.GLOSSARY_TERMS,
].map((i) => ({ i } as WidgetConfig));
