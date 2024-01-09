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
  getDashboardDetailsPath,
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getPipelineDetailsPath,
  getTableDetailsPath,
  getTopicDetailsPath,
} from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { EntityUtilClassBase } from './EntityUtilClassBase';
import { getGlossaryPath } from './RouterUtils';

jest.mock('../constants/constants', () => ({
  getContainerDetailPath: jest.fn(),
  getDashboardDetailsPath: jest.fn(),
  getDatabaseDetailsPath: jest.fn(),
  getDatabaseSchemaDetailsPath: jest.fn(),
  getDataModelDetailsPath: jest.fn(),
  getEditWebhookPath: jest.fn(),
  getMlModelPath: jest.fn(),
  getPipelineDetailsPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getStoredProcedureDetailPath: jest.fn(),
  getTableDetailsPath: jest.fn(),
  getTableTabPath: jest.fn(),
  getTagsDetailsPath: jest.fn(),
  getTopicDetailsPath: jest.fn(),
}));

jest.mock('./CommonUtils', () => ({
  getTableFQNFromColumnFQN: jest.fn(),
}));

jest.mock('./RouterUtils', () => ({
  getDataProductsDetailsPath: jest.fn(),
  getDomainDetailsPath: jest.fn(),
  getGlossaryPath: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('./SearchIndexUtils', () => ({
  getSearchIndexDetailsPath: jest.fn(),
}));

jest.mock('./StringsUtils', () => ({
  getDecodedFqn: jest.fn().mockImplementation((fqn: string) => fqn),
}));

describe('EntityUtilClassBase', () => {
  let entityUtil: EntityUtilClassBase;

  beforeEach(() => {
    entityUtil = new EntityUtilClassBase();
  });

  it('should return topic details path for topic index type', () => {
    const fqn = 'test.topic';
    entityUtil.getEntityLink(SearchIndex.TOPIC, fqn);

    expect(getTopicDetailsPath).toHaveBeenCalledWith(fqn);
  });

  it('should return dashboard details path for dashboard index type', () => {
    const fqn = 'test.dashboard';
    entityUtil.getEntityLink(SearchIndex.DASHBOARD, fqn);

    expect(getDashboardDetailsPath).toHaveBeenCalledWith(fqn);
  });

  it('should return pipeline details path for pipeline index type', () => {
    const fqn = 'test.pipeline';
    entityUtil.getEntityLink(SearchIndex.PIPELINE, fqn);

    expect(getPipelineDetailsPath).toHaveBeenCalledWith(fqn);
  });

  it('Should return database details path for database EntityType', () => {
    const fqn = 'test.database';
    entityUtil.getEntityLink(EntityType.DATABASE, fqn);

    expect(getDatabaseDetailsPath).toHaveBeenCalledWith(fqn);
  });

  it('Should return database schema details path for database EntityType', () => {
    const fqn = 'test.database.schema';
    entityUtil.getEntityLink(EntityType.DATABASE_SCHEMA, fqn);

    expect(getDatabaseSchemaDetailsPath).toHaveBeenCalledWith(fqn);
  });

  it('Should return glossary details path for database EntityType', () => {
    const fqn = 'testingGlossary';
    entityUtil.getEntityLink(EntityType.GLOSSARY, fqn);

    expect(getGlossaryPath).toHaveBeenCalledWith(fqn);
  });

  it('should return table details path for table index type', () => {
    const fqn = 'test.table';
    entityUtil.getEntityLink(SearchIndex.TABLE, fqn);

    expect(getTableDetailsPath).toHaveBeenCalledWith(fqn);
  });

  it('should return table details path for default case', () => {
    const fqn = 'test.default';
    entityUtil.getEntityLink('default', fqn);

    expect(getTableDetailsPath).toHaveBeenCalledWith(fqn);
  });
});
