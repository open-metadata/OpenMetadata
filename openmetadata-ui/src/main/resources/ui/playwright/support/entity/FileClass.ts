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
import { APIRequestContext, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import {
  Column,
  DataType,
  File,
} from '../../../src/generated/entity/data/file';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { visitEntityPageByFqn } from '../../utils/entity';
import type { DirectoryClass } from './DirectoryClass';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { DriveServiceClass } from './service/DriveServiceClass';

/**
 * Without a parent the file sits in the shard's shared drive service →
 * directory chain. Pass the deepest parent the test needs to own:
 *   - `service` — own service page, unique service name or service-level
 *     cascade;
 *   - `directory` — mutates the directory or asserts on its file listing.
 * Levels below the one passed are created fresh and deleted with the file.
 */
export type FileClassOptions = {
  name?: string;
  service?: DriveServiceClass;
  directory?: DirectoryClass;
  sharedInfraKey?: string;
};

export class FileClass extends EntityClass {
  service: DriveServiceClass['entity'];

  children: Column[];
  entity: {
    name: string;
    displayName: string;
    service: string;
    description: string;
    columns?: Column[];
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  directoryResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: File = {} as File;

  private readonly parentOverrides: Pick<
    FileClassOptions,
    'service' | 'directory'
  >;

  constructor(options: FileClassOptions = {}) {
    super(EntityTypeEndpoint.File);
    this.type = 'File';
    this.serviceCategory = SERVICE_TYPE.DriveService;
    this.serviceType = ServiceTypes.DRIVE_SERVICES;
    this.sharedInfraKey = options.sharedInfraKey;
    this.parentOverrides = {
      service: options.service,
      directory: options.directory,
    };
    // Placeholder parent names until create() binds the resolved chain.
    this.service = options.service?.entity ?? new DriveServiceClass().entity;
    const fileName = options.name ?? `pw-file-${uuid()}`;
    this.childrenSelectorId = `${this.service.name}.${fileName}`;
    this.children = [
      {
        name: 'sample_column_1',
        dataType: DataType.Bitmap,
      },
      {
        name: 'sample_column_2',
        dataType: DataType.Bitmap,
        children: [
          {
            name: 'nested_column_1',
            dataType: DataType.Bitmap,
            children: [
              {
                name: 'deeply_nested_column_1',
                dataType: DataType.Bigint,
              },
              {
                name: 'deeply_nested_column_2',
                dataType: DataType.Bigint,
              },
            ],
          },
          {
            name: 'nested_column_2',
            dataType: DataType.Bigint,
          },
        ],
      },
    ];
    this.entity = {
      name: fileName,
      displayName: fileName,
      service: this.service.name,
      description: 'description',
      columns: this.children,
    };
  }

  // createOrFetch, not a bare POST: these names are generated once, when the
  // class is constructed. Specs that build their fixtures in the describe body
  // (LineageFilters, for one) do not re-evaluate it on a retry, so beforeAll
  // runs a second time with the same names and every create answers 409
  // "Entity already exists" — the retry fails in the hook and takes the whole
  // file with it. Treating the conflict as success and fetching the entity
  // makes create idempotent, which is what a retry needs it to be.
  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'driveDirectory',
      this.parentOverrides,
      this.sharedInfraKey
    );
    const service = parents.service as ResponseDataType;
    const directory = parents.directory as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindServiceName(service.name);
    this.serviceResponseData = service;
    this.directoryResponseData = directory;

    // Create file in directory. `columns` has to be requested explicitly: it is
    // in FileResource.FIELDS, so the POST returns it but a by-name lookup does
    // not, and the conflict path below reads columns[0] for childrenSelectorId.
    // Without it a retry would quietly leave that selector empty and fail later,
    // in a column test, rather than here.
    this.entityResponseData = await createOrFetch<File>(apiContext, {
      label: 'FileClass.create file',
      createPath: `/api/v1/${EntityTypeEndpoint.File}`,
      fqnSegments: [service.name, directory.name, this.entity.name],
      fields: 'columns',
      data: {
        ...this.entity,
        directory: directory.fullyQualifiedName,
      },
    });

    this.childrenSelectorId =
      this.entityResponseData.columns?.[0]?.fullyQualifiedName ?? '';

    return {
      service: this.serviceResponseData,
      directory: this.directoryResponseData,
      entity: this.entityResponseData,
    };
  }

  private bindServiceName(serviceName: string) {
    this.service = { ...this.service, name: serviceName };
    this.entity.service = serviceName;
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/${EntityTypeEndpoint.File}/name/${this.entityResponseData.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(response, 'FileClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      directory: this.directoryResponseData,
      entity: this.entityResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: File;
    service: ResponseDataType;
    directory: ResponseDataType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.directoryResponseData = data.directory;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.bindServiceName(data.service.name);
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(
      apiContext,
      `/api/v1/${EntityTypeEndpoint.File}/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
