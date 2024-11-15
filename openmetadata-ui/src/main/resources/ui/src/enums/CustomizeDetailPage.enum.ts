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
export enum WidgetWidths {
  large = 3,
  medium = 2,
  small = 1,
}

export enum DetailPageWidgetKeys {
  TABS = 'KnowledgePanel.Tabs',
  HEADER = 'KnowledgePanel.Header',
  ANNOUNCEMENTS = 'KnowledgePanel.Announcements',
  DESCRIPTION = 'KnowledgePanel.Description',
  TABLE_SCHEMA = 'KnowledgePanel.TableSchema',
  TOPIC_SCHEMA = 'KnowledgePanel.TopicSchema',
  FREQUENTLY_JOINED_TABLES = 'KnowledgePanel.FrequentlyJoinedTables',
  DATA_PRODUCTS = 'KnowledgePanel.DataProducts',
  TAGS = 'KnowledgePanel.Tags',
  DOMAIN = 'KnowledgePanel.Domain',
  GLOSSARY_TERMS = 'KnowledgePanel.GlossaryTerms',
  CUSTOM_PROPERTIES = 'KnowledgePanel.CustomProperties',
  EMPTY_WIDGET_PLACEHOLDER = 'ExtraWidget.EmptyWidgetPlaceholder',
}

export enum GlossaryTermDetailPageWidgetKeys {
  TABS = 'KnowledgePanel.Tabs',
  HEADER = 'KnowledgePanel.Header',
  DESCRIPTION = 'KnowledgePanel.Description',
  TAGS = 'KnowledgePanel.Tags',
  SYNONYMS = 'KnowledgePanel.Synonyms',
  RELATED_TERMS = 'KnowledgePanel.RelatedTerms',
  REFERENCES = 'KnowledgePanel.References',
  OWNER = 'KnowledgePanel.Owner',
  DOMAIN = 'KnowledgePanel.Domain',
  REVIEWER = 'KnowledgePanel.Reviewer',
  CUSTOM_PROPERTIES = 'KnowledgePanel.CustomProperties',
  EMPTY_WIDGET_PLACEHOLDER = 'ExtraWidget.EmptyWidgetPlaceholder',
  TERMS_TABLE = 'KnowledgePanel.TermsTable',
}
