package org.openmetadata.service.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.ContextFileContentRepository;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.security.Authorizer;

class DefaultContextEntityPromptLoaderTest {

  @Test
  void resolveExtractedTextPrefersCanonicalContentSnapshot() throws Exception {
    Authorizer authorizer = mock(Authorizer.class);
    ContextFileRepository contextFileRepository = mock(ContextFileRepository.class);
    ContextFileContentRepository contentRepository = mock(ContextFileContentRepository.class);
    KnowledgePageRepository knowledgeCenterRepository = mock(KnowledgePageRepository.class);

    UUID contentId = UUID.randomUUID();

    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("revenue-chart")
            .withDisplayName("Revenue Chart")
            .withFullyQualifiedName("drive.revenue-chart")
            .withFileType(ContextFileType.Image)
            .withDescription("Quarterly snapshot")
            .withHeadContentId(contentId.toString())
            .withExtractedText("Indexed excerpt only");
    ContextFileContent content =
        new ContextFileContent()
            .withId(contentId)
            .withExtractedText("Canonical OCR text with full numeric callouts");

    when(contentRepository.getById(contentId)).thenReturn(content);

    DefaultContextEntityPromptLoader loader =
        new DefaultContextEntityPromptLoader(
            authorizer, contextFileRepository, contentRepository, knowledgeCenterRepository);
    Method resolveExtractedText =
        DefaultContextEntityPromptLoader.class.getDeclaredMethod(
            "resolveExtractedText", ContextFile.class);
    resolveExtractedText.setAccessible(true);

    String extractedText = (String) resolveExtractedText.invoke(loader, file);

    assertEquals("Canonical OCR text with full numeric callouts", extractedText);
  }

  @Disabled(
      "Requires Entity registry initialized with ContextFileRepository; authorizeView "
          + "calls new ResourceContext(...) which looks up Entity.getEntityRepository(\"contextFile\"). "
          + "Integration test coverage verifies this end-to-end.")
  @Test
  void loadContextFileBuildsPromptEntityFromCanonicalContentSnapshot() {
    Authorizer authorizer = mock(Authorizer.class);
    ContextFileRepository contextFileRepository = mock(ContextFileRepository.class);
    ContextFileContentRepository contentRepository = mock(ContextFileContentRepository.class);
    KnowledgePageRepository knowledgeCenterRepository = mock(KnowledgePageRepository.class);

    UUID fileId = UUID.randomUUID();
    UUID contentId = UUID.randomUUID();
    EntityReference reference =
        new EntityReference()
            .withId(fileId)
            .withType("contextFile")
            .withName("revenue-playbook")
            .withFullyQualifiedName("drive.revenue-playbook")
            .withDisplayName("Revenue Playbook");

    ContextFile file =
        new ContextFile()
            .withId(fileId)
            .withName("revenue-playbook")
            .withDisplayName("Revenue Playbook")
            .withFullyQualifiedName("drive.revenue-playbook")
            .withDescription("Reusable guidance for AskCollate")
            .withFileType(ContextFileType.PDF)
            .withHeadContentId(contentId.toString());
    ContextFileContent content =
        new ContextFileContent()
            .withId(contentId)
            .withExtractedText("Use median and percentiles when the distribution is skewed.");

    when(contextFileRepository.get(isNull(), eq(fileId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(file);
    when(contentRepository.getById(contentId)).thenReturn(content);

    DefaultContextEntityPromptLoader loader =
        new DefaultContextEntityPromptLoader(
            authorizer, contextFileRepository, contentRepository, knowledgeCenterRepository);

    Optional<ResolvedContextEntity> resolved = loader.load(null, reference);

    assertTrue(resolved.isPresent());
    assertEquals("File (PDF)", resolved.get().label());
    assertEquals("Revenue Playbook", resolved.get().title());
    assertEquals("drive.revenue-playbook", resolved.get().location());
    assertEquals("Reusable guidance for AskCollate", resolved.get().summary());
    assertEquals(
        "Use median and percentiles when the distribution is skewed.", resolved.get().body());
    verify(authorizer).authorize(isNull(), any(), any());
  }
}
