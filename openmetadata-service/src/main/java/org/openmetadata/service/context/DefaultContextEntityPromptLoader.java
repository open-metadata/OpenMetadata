package org.openmetadata.service.context;

import static org.openmetadata.service.jdbi3.KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;
import static org.openmetadata.service.jdbi3.ContextFileRepository.CONTEXT_FILE_ENTITY;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jdbi3.ContextFileContentRepository;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
class DefaultContextEntityPromptLoader implements ContextEntityPromptLoader {
  private record LoaderDependencies(
      ContextFileRepository contextFileRepository,
      ContextFileContentRepository contextFileContentRepository,
      KnowledgePageRepository knowledgeCenterRepository) {}

  private final Authorizer authorizer;
  private final ContextFileRepository contextFileRepository;
  private final ContextFileContentRepository contextFileContentRepository;
  private final KnowledgePageRepository knowledgeCenterRepository;

  DefaultContextEntityPromptLoader(Authorizer authorizer) {
    this(authorizer, defaultDependencies());
  }

  private DefaultContextEntityPromptLoader(Authorizer authorizer, LoaderDependencies dependencies) {
    this(
        authorizer,
        dependencies.contextFileRepository(),
        dependencies.contextFileContentRepository(),
        dependencies.knowledgeCenterRepository());
  }

  private static LoaderDependencies defaultDependencies() {
    ContextFileRepository contextFileRepository =
        (ContextFileRepository) Entity.getEntityRepository(CONTEXT_FILE_ENTITY);
    return new LoaderDependencies(
        contextFileRepository,
        contextFileRepository == null ? null : contextFileRepository.getContentRepository(),
        (KnowledgePageRepository) Entity.getEntityRepository(KNOWLEDGE_PAGE_ENTITY));
  }

  DefaultContextEntityPromptLoader(
      Authorizer authorizer,
      ContextFileRepository contextFileRepository,
      ContextFileContentRepository contextFileContentRepository,
      KnowledgePageRepository knowledgeCenterRepository) {
    this.authorizer = authorizer;
    this.contextFileRepository = contextFileRepository;
    this.contextFileContentRepository = contextFileContentRepository;
    this.knowledgeCenterRepository = knowledgeCenterRepository;
  }

  @Override
  public Optional<ResolvedContextEntity> load(
      SecurityContext securityContext, EntityReference reference) {
    if (reference == null || reference.getId() == null || nullOrEmpty(reference.getType())) {
      return Optional.empty();
    }

    try {
      return switch (reference.getType()) {
        case CONTEXT_FILE_ENTITY -> loadContextFile(securityContext, reference);
        case KNOWLEDGE_PAGE_ENTITY -> loadPage(securityContext, reference);
        default -> Optional.empty();
      };
    } catch (Exception e) {
      LOG.debug("Skipping context entity {} due to load failure", reference, e);
      return Optional.empty();
    }
  }

  private Optional<ResolvedContextEntity> loadContextFile(
      SecurityContext securityContext, EntityReference reference) {
    authorizeView(securityContext, reference);

    ContextFile file =
        contextFileRepository.get(
            null,
            reference.getId(),
            contextFileRepository.getFields("folder"),
            Include.NON_DELETED,
            false);

    String extractedText = resolveExtractedText(file);
    String summary = normalize(file.getDescription());
    if (nullOrEmpty(extractedText) && nullOrEmpty(summary)) {
      return Optional.empty();
    }

    return Optional.of(
        new ResolvedContextEntity(
            file.getEntityReference(),
            file.getFileType() == null ? "File" : "File (" + file.getFileType() + ")",
            firstNonBlank(file.getDisplayName(), file.getName()),
            firstNonBlank(file.getFullyQualifiedName(), reference.getFullyQualifiedName()),
            summary,
            normalize(extractedText)));
  }

  private Optional<ResolvedContextEntity> loadPage(
      SecurityContext securityContext, EntityReference reference) {
    authorizeView(securityContext, reference);

    Page page =
        knowledgeCenterRepository.get(
            null, reference.getId(), EntityUtil.Fields.EMPTY_FIELDS, Include.NON_DELETED, false);

    StringBuilder body = new StringBuilder();
    String description = normalize(page.getDescription());
    if (!nullOrEmpty(description)) {
      body.append(description);
    }

    if (page.getPageType() == PageType.QUICK_LINK && page.getPage() != null) {
      QuickLink quickLink = JsonUtils.convertValue(page.getPage(), QuickLink.class);
      if (quickLink != null && !nullOrEmpty(quickLink.getUrl())) {
        if (body.length() > 0) {
          body.append("\n");
        }
        body.append("Quick link URL: ").append(quickLink.getUrl());
      }
    }

    if (body.isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(
        new ResolvedContextEntity(
            page.getEntityReference(),
            page.getPageType() == PageType.QUICK_LINK ? "Quick Link" : "Page",
            firstNonBlank(page.getDisplayName(), page.getName()),
            firstNonBlank(page.getFullyQualifiedName(), reference.getFullyQualifiedName()),
            null,
            body.toString()));
  }

  private String resolveExtractedText(ContextFile file) {
    UUID contentId = parseUuid(file.getHeadContentId());
    if (contentId != null && contextFileContentRepository != null) {
      ContextFileContent content = contextFileContentRepository.getById(contentId);
      if (content != null && !nullOrEmpty(content.getExtractedText())) {
        return content.getExtractedText();
      }
    }
    return file.getExtractedText();
  }

  private void authorizeView(SecurityContext securityContext, EntityReference reference) {
    authorizer.authorize(
        securityContext,
        new OperationContext(reference.getType(), MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(
            reference.getType(), reference.getId(), reference.getFullyQualifiedName()));
  }

  private String firstNonBlank(String primary, String fallback) {
    return nullOrEmpty(primary) ? fallback : primary;
  }

  private String normalize(String value) {
    return nullOrEmpty(value) ? null : value.trim();
  }

  private UUID parseUuid(String value) {
    if (nullOrEmpty(value)) {
      return null;
    }
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }
}
