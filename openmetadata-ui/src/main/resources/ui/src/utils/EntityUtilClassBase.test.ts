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

import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { EntityUtilClassBase } from './EntityUtilClassBase';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from './RouterUtils';
import { getTestSuiteDetailsPath } from './TestSuiteUtils';

jest.mock('../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
  getEditWebhookPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getTagsDetailsPath: jest.fn(),
  getGlossaryTermDetailsPath: jest.fn(),
  getUserPath: jest.fn(),
}));

jest.mock('./CommonUtils', () => ({
  getTableFQNFromColumnFQN: jest.fn(),
}));

jest.mock('./RouterUtils', () => ({
  getEntityDetailsPath: jest.fn(),
  getDomainDetailsPath: jest.fn(),
  getSettingPath: jest.fn(),
  getTeamsWithFqnPath: jest.fn(),
  getEditWebhookPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getTagsDetailsPath: jest.fn(),
  getGlossaryTermDetailsPath: jest.fn(),
  getUserPath: jest.fn(),
}));

jest.mock('./TestSuiteUtils', () => ({
  getTestSuiteDetailsPath: jest.fn(),
}));

describe('EntityUtilClassBase', () => {
  let entityUtil: EntityUtilClassBase;

  beforeEach(() => {
    entityUtil = new EntityUtilClassBase();
  });

  it('should return topic details path for topic index type', () => {
    const fqn = 'test.topic';
    entityUtil.getEntityLink(SearchIndex.TOPIC, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TOPIC,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return dashboard details path for dashboard index type', () => {
    const fqn = 'test.dashboard';
    entityUtil.getEntityLink(SearchIndex.DASHBOARD, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.DASHBOARD,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return pipeline details path for pipeline index type', () => {
    const fqn = 'test.pipeline';
    entityUtil.getEntityLink(SearchIndex.PIPELINE, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.PIPELINE,
      fqn,
      undefined,
      undefined
    );
  });

  it('Should return database details path for database EntityType', () => {
    const fqn = 'test.database';
    entityUtil.getEntityLink(EntityType.DATABASE, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.DATABASE,
      fqn,
      undefined,
      undefined
    );
  });

  it('Should return database schema details path for database EntityType', () => {
    const fqn = 'test.database.schema';
    entityUtil.getEntityLink(EntityType.DATABASE_SCHEMA, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.DATABASE_SCHEMA,
      fqn,
      undefined,
      undefined
    );
  });

  it('Should return glossary details path for database EntityType', () => {
    const fqn = 'testingGlossary';
    entityUtil.getEntityLink(EntityType.GLOSSARY, fqn);

    expect(getGlossaryTermDetailsPath).toHaveBeenCalledWith(
      fqn,
      undefined,
      undefined
    );
  });

  it('should return testSuite details path for testSuite EntityType', () => {
    const fqn = 'test.default';
    entityUtil.getEntityLink(EntityType.TEST_SUITE, fqn);

    expect(getTestSuiteDetailsPath).toHaveBeenCalledWith({
      fullyQualifiedName: 'test.default',
      isExecutableTestSuite: undefined,
    });
  });

  it('should return table details path for table index type', () => {
    const fqn = 'test.table';
    entityUtil.getEntityLink(SearchIndex.TABLE, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TABLE,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return table details path for default case', () => {
    const fqn = 'test.default';
    entityUtil.getEntityLink('default', fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TABLE,
      fqn,
      undefined,
      undefined
    );
  });
});
