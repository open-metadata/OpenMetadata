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
import { APIRequestContext } from '@playwright/test';
import { Domain } from '../domain/Domain';
import { Glossary } from '../glossary/Glossary';
import { GlossaryTerm } from '../glossary/GlossaryTerm';
import { TagClass } from '../tag/TagClass';
import { TeamClass } from '../team/TeamClass';
import { UserClass } from '../user/UserClass';

export class EntityDataClass {
  static readonly domain1 = new Domain();
  static readonly domain2 = new Domain();
  static readonly glossary1 = new Glossary();
  static readonly glossary2 = new Glossary();
  static readonly glossaryTerm1 = new GlossaryTerm(this.glossary1);
  static readonly glossaryTerm2 = new GlossaryTerm(this.glossary2);
  static readonly user1 = new UserClass();
  static readonly user2 = new UserClass();
  static readonly user3 = new UserClass();
  static readonly team1 = new TeamClass();
  static readonly team2 = new TeamClass();
  static readonly tierTag1 = new TagClass({ classification: 'Tier' });

  static async preRequisitesForTests(apiContext: APIRequestContext) {
    // Add pre-requisites for tests
    await this.domain1.create(apiContext);
    await this.domain2.create(apiContext);
    await this.glossary1.create(apiContext);
    await this.glossary2.create(apiContext);
    await this.glossaryTerm1.create(apiContext);
    await this.glossaryTerm2.create(apiContext);
    await this.user1.create(apiContext);
    await this.user2.create(apiContext);
    await this.user3.create(apiContext);
    await this.team1.create(apiContext);
    await this.team2.create(apiContext);
    await this.tierTag1.create(apiContext);
  }

  static async postRequisitesForTests(apiContext: APIRequestContext) {
    // Add post-requisites for tests
    await this.domain1.delete(apiContext);
    await this.domain2.delete(apiContext);
    // deleting glossary will also delete the glossary terms
    await this.glossary1.delete(apiContext);
    await this.glossary2.delete(apiContext);
    await this.user1.delete(apiContext);
    await this.user2.delete(apiContext);
    await this.user3.delete(apiContext);
    await this.team1.delete(apiContext);
    await this.team2.delete(apiContext);
    await this.tierTag1.delete(apiContext);
  }
}
