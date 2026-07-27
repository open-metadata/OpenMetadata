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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SystemRepositoryPrincipalDomainTest {

  @Test
  void validDomainsAreAccepted() {
    assertTrue(SystemRepository.isValidPrincipalDomain("company.com"));
    assertTrue(SystemRepository.isValidPrincipalDomain("getcollate.io"));
    assertTrue(SystemRepository.isValidPrincipalDomain("sub.company.co.uk"));
    assertTrue(SystemRepository.isValidPrincipalDomain("  company.com  "));
  }

  @Test
  void invalidDomainsAreRejected() {
    assertFalse(SystemRepository.isValidPrincipalDomain(null));
    assertFalse(SystemRepository.isValidPrincipalDomain(""));
    assertFalse(SystemRepository.isValidPrincipalDomain("https://accounts.google.com"));
    assertFalse(SystemRepository.isValidPrincipalDomain("company"));
    assertFalse(SystemRepository.isValidPrincipalDomain("user@company.com"));
    assertFalse(SystemRepository.isValidPrincipalDomain("company .com"));
    assertFalse(SystemRepository.isValidPrincipalDomain("company/path"));
  }
}
