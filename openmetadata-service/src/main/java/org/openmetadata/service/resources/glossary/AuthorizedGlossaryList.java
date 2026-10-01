/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.resources.glossary;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

/** Evaluates glossary visibility before applying the caller's page size or reporting a total. */
final class AuthorizedGlossaryList {
  private static final int BATCH_SIZE = 100;

  record PageRequest(int limit, String before, String after) {}

  private final GlossaryRepository repository;
  private final Authorizer authorizer;
  private final SecurityContext securityContext;
  private final MetadataOperation[] operations;
  private final Fields authorizationFields;

  AuthorizedGlossaryList(
      GlossaryRepository repository,
      Authorizer authorizer,
      SecurityContext securityContext,
      MetadataOperation[] operations) {
    this.repository = repository;
    this.authorizer = authorizer;
    this.securityContext = securityContext;
    this.operations = operations.clone();
    this.authorizationFields = ResourceContext.authorizationFields(repository);
  }

  ResultList<Glossary> list(Fields fields, ListFilter filter, PageRequest request) {
    authorizeList();
    final int total = countVisible(filter);
    final ResultList<Glossary> result = readPage(filter, request, total);
    repository.setFieldsInBulk(fields, result.getData());
    result.getData().forEach(glossary -> repository.clearFieldsInternal(glossary, fields));
    return result;
  }

  private void authorizeList() {
    final ResourcePermission permission =
        authorizer.getPermission(securityContext, null, Entity.GLOSSARY);
    final List<MetadataOperation> required = List.of(operations);
    final boolean denied =
        permission.getPermissions().stream()
            .anyMatch(
                operation ->
                    required.contains(operation.getOperation())
                        && (operation.getAccess() == Access.DENY
                            || operation.getAccess() == Access.NOT_ALLOW));
    if (denied) {
      authorizer.authorize(
          securityContext, operationContext(), new ResourceContext<>(Entity.GLOSSARY));
    }
  }

  private int countVisible(ListFilter filter) {
    int total = 0;
    String cursor = null;
    do {
      final ResultList<Glossary> batch = visibleBatch(filter, cursor, false);
      total += batch.getData().size();
      cursor = batch.getPaging().getAfter();
    } while (cursor != null);
    return total;
  }

  private ResultList<Glossary> readPage(ListFilter filter, PageRequest request, int total) {
    if (request.limit() == 0 || total == 0) {
      return repository.getResultList(new ArrayList<>(), null, null, total);
    }
    final List<Glossary> visible = collectPage(filter, request);
    final boolean hasMore = visible.size() > request.limit();
    final List<Glossary> page = trimPage(visible, request, hasMore);
    final String first =
        page.isEmpty()
            ? RestUtil.decodeCursor(request.after())
            : repository.getCursorValue(page.getFirst(), filter);
    final String last =
        page.isEmpty()
            ? RestUtil.decodeCursor(request.before())
            : repository.getCursorValue(page.getLast(), filter);
    final String before =
        request.before() != null
            ? (hasMore ? first : null)
            : (nullOrEmpty(request.after()) ? null : first);
    final String after = request.before() != null ? last : (hasMore ? last : null);
    return repository.getResultList(page, before, after, total);
  }

  private List<Glossary> collectPage(ListFilter filter, PageRequest request) {
    final boolean reverse = request.before() != null;
    final Deque<Glossary> visible = new ArrayDeque<>();
    String cursor = reverse ? request.before() : request.after();
    do {
      final ResultList<Glossary> batch = visibleBatch(filter, cursor, reverse);
      if (reverse) {
        batch.getData().reversed().forEach(visible::addFirst);
      } else {
        visible.addAll(batch.getData());
      }
      cursor = reverse ? batch.getPaging().getBefore() : batch.getPaging().getAfter();
    } while (visible.size() <= request.limit() && cursor != null);
    return new ArrayList<>(visible);
  }

  private List<Glossary> trimPage(List<Glossary> visible, PageRequest request, boolean hasMore) {
    if (!hasMore) {
      return visible;
    }
    final int start = request.before() != null ? visible.size() - request.limit() : 0;
    return new ArrayList<>(visible.subList(start, start + request.limit()));
  }

  private ResultList<Glossary> visibleBatch(ListFilter filter, String cursor, boolean reverse) {
    final ResultList<Glossary> batch =
        reverse
            ? repository.listBefore(null, authorizationFields, filter, BATCH_SIZE, cursor)
            : repository.listAfter(null, authorizationFields, filter, BATCH_SIZE, cursor);
    final BulkFieldHydrator hydrator =
        new BulkFieldHydrator(
            Map.of(Entity.FIELD_TAGS, () -> repository.batchLoadTags(batch.getData())));
    // Keep the storage cursor until scanning finishes, including when every row is forbidden.
    final List<Glossary> visible =
        batch.getData().stream().filter(glossary -> canView(glossary, hydrator)).toList();
    batch.setData(visible);
    return batch;
  }

  private boolean canView(Glossary glossary, BulkFieldHydrator hydrator) {
    boolean allowed = true;
    try {
      authorizer.authorize(
          securityContext,
          operationContext(),
          new ResourceContext<>(Entity.GLOSSARY, glossary, repository, hydrator));
    } catch (AuthorizationException denied) {
      allowed = false;
    }
    return allowed;
  }

  private OperationContext operationContext() {
    // Policy evaluation consumes allowed operations, so each glossary needs its own context.
    return new OperationContext(Entity.GLOSSARY, operations);
  }
}
