package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.ContextFileFqnRepair;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * A PATCH on a Context Center file used to load it without its folder, so the file's FQN and the
 * nameHash written with it fell back to its bare name. The 2.1.0 migration derives them from the
 * folder again.
 */
// Sequential: repairAll sweeps every Context Center file in the database.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class ContextFileFqnRepairMigrationIT {
  private static final String FILES = "/v1/contextCenter/drive/files";
  private static final String FOLDERS = "/v1/contextCenter/drive/folders";
  private static final String GLOSSARIES = "/v1/glossaries";
  private static final String GLOSSARY_TERMS = "/v1/glossaryTerms";
  private static final String TAG_BEFORE_THE_EDIT = "PII.NonSensitive";
  private static final String TAG_FROM_THE_EDIT = "PersonalData.Personal";
  private static final String OTHER_ENTITY_TAG = "PII.NonSensitive";
  private static final String FILE_TAG = "PersonalData.SpecialCategory";

  // Folders this test created and must delete itself: TestNamespaceExtension cleans only the root
  // types it knows (glossaries, context files, …), and folders are not in its collection map.
  // Deleting a folder cascades the files and subfolders inside it.
  private final List<UUID> foldersToCleanup = new ArrayList<>();

  @AfterEach
  void deleteFolders() {
    for (UUID id : foldersToCleanup) {
      try {
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.DELETE, FOLDERS + "/" + id + "?hardDelete=true", null, Object.class);
      } catch (RuntimeException ignored) {
        // Best-effort, like NamespaceCleanup: a failed delete never fails a green test.
      }
    }
    foldersToCleanup.clear();
  }

  private Folder trackFolder(Folder folder) {
    foldersToCleanup.add(folder.getId());
    return folder;
  }

  @Test
  void aFileEditedInAFolderGetsItsFolderBackInItsFqn(TestNamespace ns) {
    Folder folder = createFolder(ns.shortPrefix("reports"));
    String name = ns.shortPrefix("q3") + ".pdf";
    ContextFile file = createFile(name, folder, TAG_BEFORE_THE_EDIT);
    String folderFqn = file.getFullyQualifiedName();
    // An edit wrote its tags under the bare name, one of them the tag the file already had.
    damageAsAnEditDid(file, TAG_FROM_THE_EDIT, TAG_BEFORE_THE_EDIT);
    assertThrows(
        OpenMetadataException.class,
        () -> getByName(folderFqn),
        "an edited file is not found under its folder before the repair");

    assertEquals(1, repairAll());

    ContextFile repaired = getByName(folderFqn);
    assertEquals(file.getId(), repaired.getId());
    assertEquals(folderFqn, repaired.getFullyQualifiedName());
    assertEquals(FullyQualifiedName.buildHash(folderFqn), storedNameHash(file.getId()));
    assertEquals(
        List.of(TAG_BEFORE_THE_EDIT, TAG_FROM_THE_EDIT),
        tagFqns(repaired.getTags()),
        "the tags from before and from the edit, each once");
    assertEquals(0, tagRowsUnder(name), "no other entity has the bare name, so its rows moved");
    assertEquals(
        name,
        createFile(name, null, null).getFullyQualifiedName(),
        "a root-level file can take the bare name again");
    assertEquals(0, repairAll(), "a repaired file needs nothing on a second run");
  }

  @Test
  void aFileWhoseFqnAnotherFileHoldsIsLeftAsItIs(TestNamespace ns) {
    // A root-level FQN is the name as typed, dots included, so a root file named
    // "<folder>.<file>" holds the FQN a file in that folder derives.
    Folder folder = createFolder(ns.shortPrefix("box") + ".archive");
    String name = ns.shortPrefix("memo");
    ContextFile file = createFile(name, folder, null);
    damageAsAnEditDid(file);
    ContextFile holder = createFile(file.getFullyQualifiedName(), null, null);
    assertEquals(file.getFullyQualifiedName(), holder.getFullyQualifiedName());

    assertEquals(0, repairAll());

    assertEquals(name, getById(file.getId()).getFullyQualifiedName());
    assertEquals(holder.getId(), getByName(holder.getFullyQualifiedName()).getId());
  }

  @Test
  void aRootFolderNamedLikeTheFileKeepsEveryTagRowUnderTheBareName(TestNamespace ns) {
    // A root folder's FQN is its name, the bare FQN an edit gave a file in another folder.
    String bareName = ns.shortPrefix("Finance");
    Folder rootFolder = createFolder(bareName, OTHER_ENTITY_TAG, FILE_TAG);
    ContextFile file = createFile(bareName, createFolder(ns.shortPrefix("Archive")), FILE_TAG);

    assertSharedRowsStayWithTheOtherEntity(file, () -> folderTags(rootFolder));
  }

  @Test
  void aRootGlossaryNamedLikeTheFileKeepsEveryTagRowUnderTheBareName(TestNamespace ns) {
    String bareName = ns.shortPrefix("Finance");
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    GLOSSARIES,
                    new CreateGlossary()
                        .withName(bareName)
                        .withDescription("Named like a Context Center file")
                        .withTags(List.of(tagLabel(OTHER_ENTITY_TAG), tagLabel(FILE_TAG))),
                    Glossary.class));
    ContextFile file = createFile(bareName, createFolder(ns.shortPrefix("Archive")), FILE_TAG);

    assertSharedRowsStayWithTheOtherEntity(file, () -> glossaryTags(glossary));
  }

  @Test
  void aSubfolderNamedLikeTheFileUnderTheSameParentKeepsEveryTagRowUnderTheBareName(
      TestNamespace ns) {
    // A subfolder under the file's folder holds the file's derived FQN, as a glossary term or
    // subdomain named like the file can too. Moving the file's tag_usage rows onto that hash
    // would merge them with the subfolder's, so the repair gives the file its folder FQN and
    // leaves every row under the bare name where it is, mirroring the stored-FQN policy.
    Folder parent = trackFolder(createFolder(ns.shortPrefix("Y")));
    String name = ns.shortPrefix("x");
    ContextFile file = ns.trackRoot(Entity.CONTEXT_FILE, createFile(name, parent, FILE_TAG));
    damageAsAnEditDid(file, TAG_FROM_THE_EDIT);
    Folder subfolder = trackFolder(createFolder(name, parent, OTHER_ENTITY_TAG, FILE_TAG));
    String folderFqn = subfolder.getFullyQualifiedName();
    List<String> subfolderTagsBefore = folderTags(subfolder);
    assertEquals(List.of(OTHER_ENTITY_TAG, FILE_TAG), subfolderTagsBefore);
    int rowsUnderBareName = tagRowsUnder(name);

    assertEquals(1, repairAll());
    assertTagsStayUnderTheirOwner(
        file, folderFqn, subfolderTagsBefore, () -> folderTags(subfolder), name, rowsUnderBareName);
  }

  /** A glossary term named like the file under a glossary named like the file's folder. */
  @Test
  void aGlossaryTermNamedLikeTheFileKeepsEveryTagRowUnderTheBareName(TestNamespace ns) {
    String folderName = ns.shortPrefix("Y");
    String name = ns.shortPrefix("x");
    GlossaryTerm term = glossaryTermNamedLikeTheFile(ns, folderName, name);
    Folder parent = trackFolder(createFolder(folderName));
    ContextFile file = ns.trackRoot(Entity.CONTEXT_FILE, createFile(name, parent, FILE_TAG));
    damageAsAnEditDid(file, TAG_FROM_THE_EDIT);
    String termFqn = term.getFullyQualifiedName();
    List<String> termTagsBefore = glossaryTermTags(term);
    assertEquals(List.of(OTHER_ENTITY_TAG, FILE_TAG), termTagsBefore);
    int rowsUnderBareName = tagRowsUnder(name);
    int rowsUnderDerivedFqn = tagRowsUnder(termFqn);

    assertEquals(1, repairAll());
    assertTagsStayUnderTheirOwner(
        file, termFqn, termTagsBefore, () -> glossaryTermTags(term), name, rowsUnderBareName);
    assertEquals(
        rowsUnderDerivedFqn, tagRowsUnder(termFqn), "no row moved onto the glossary term's hash");
  }

  /**
   * Damages {@code file} as an edit did, writing a tag under its bare name, which another entity
   * also has as its FQN, with one tag the file also has under its folder FQN. The repair gives the
   * file its folder FQN and leaves every row under the bare name where it is: the other entity
   * shows what it showed, and the file only its own.
   */
  private static void assertSharedRowsStayWithTheOtherEntity(
      ContextFile file, Supplier<List<String>> otherEntityTags) {
    String bareName = file.getName();
    String folderFqn = file.getFullyQualifiedName();
    damageAsAnEditDid(file, TAG_FROM_THE_EDIT);
    List<String> shownBefore = otherEntityTags.get();
    assertEquals(List.of(OTHER_ENTITY_TAG, TAG_FROM_THE_EDIT, FILE_TAG), shownBefore);
    int rowsUnderBareName = tagRowsUnder(bareName);

    assertEquals(1, repairAll());

    ContextFile repaired = getByName(folderFqn);
    assertEquals(file.getId(), repaired.getId());
    assertEquals(FullyQualifiedName.buildHash(folderFqn), storedNameHash(file.getId()));
    assertEquals(shownBefore, otherEntityTags.get(), "the other entity keeps every tag it had");
    assertEquals(
        rowsUnderBareName, tagRowsUnder(bareName), "no row under the bare name moves or goes");
    assertEquals(
        List.of(FILE_TAG), tagFqns(repaired.getTags()), "the file gains no tag it did not own");
    assertEquals(0, repairAll(), "a repaired file needs nothing on a second run");
  }

  /**
   * A derived-FQN collision leaves the file's tag rows where they are: the file takes the derived
   * FQN (its nameHash is unique per table), the other entity keeps every tag it had, no row under
   * the bare name moves, and a second run repairs nothing.
   */
  private static void assertTagsStayUnderTheirOwner(
      ContextFile file,
      String derivedFqn,
      List<String> otherTagsBefore,
      Supplier<List<String>> otherTagsAfter,
      String bareName,
      int rowsUnderBareName) {
    assertEquals(
        FullyQualifiedName.buildHash(derivedFqn),
        storedNameHash(file.getId()),
        "the file takes the derived FQN");
    assertEquals(
        otherTagsBefore,
        otherTagsAfter.get(),
        "the other entity keeps every tag it had; the file's tags did not merge in");
    assertEquals(
        rowsUnderBareName, tagRowsUnder(bareName), "no row under the bare name moves or goes");
    assertEquals(0, repairAll(), "a repaired file needs nothing on a second run");
  }

  private static int repairAll() {
    ConnectionType engine =
        "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
            ? ConnectionType.MYSQL
            : ConnectionType.POSTGRES;
    return TestSuiteBootstrap.getJdbi()
        .withHandle(handle -> ContextFileFqnRepair.repairAll(handle, engine));
  }

  /** Stores the file as a PATCH did when it loaded the file without its folder. */
  private static void damageAsAnEditDid(ContextFile file, String... tagsFromTheEdit) {
    CollectionDAO dao = Entity.getCollectionDAO();
    ContextFile stored = dao.contextFileDAO().findEntityById(file.getId(), Include.ALL);
    stored.setFullyQualifiedName(stored.getName());
    dao.contextFileDAO().update(stored);
    EntityRepository.invalidateCacheForEntity(
        Entity.CONTEXT_FILE, file.getId(), file.getFullyQualifiedName());
    for (String tag : tagsFromTheEdit) {
      dao.tagUsageDAO()
          .applyTag(
              TagLabel.TagSource.CLASSIFICATION.ordinal(),
              tag,
              tag,
              stored.getFullyQualifiedName(),
              TagLabel.LabelType.MANUAL.ordinal(),
              TagLabel.State.CONFIRMED.ordinal(),
              null,
              "admin");
    }
  }

  private static String storedNameHash(UUID id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT nameHash FROM context_file WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .one());
  }

  private static int tagRowsUnder(String targetFqn) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM tag_usage WHERE targetFQNHash = :hash")
                    .bind("hash", FullyQualifiedName.buildHash(targetFqn))
                    .mapTo(Integer.class)
                    .one());
  }

  private static List<String> tagFqns(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).sorted().toList();
  }

  private static List<String> glossaryTags(Glossary glossary) {
    return tagFqns(
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                GLOSSARIES + "/" + glossary.getId() + "?fields=tags",
                null,
                Glossary.class)
            .getTags());
  }

  private static List<String> glossaryTermTags(GlossaryTerm term) {
    return tagFqns(
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                GLOSSARY_TERMS
                    + "/name/"
                    + encodeURIComponent(term.getFullyQualifiedName())
                    + "?fields=tags",
                null,
                GlossaryTerm.class)
            .getTags());
  }

  /** A glossary named like the file's folder, tracked so its cascade cleans its terms. */
  private static Glossary createGlossary(
      TestNamespace ns, String name, String description, String... tags) {
    CreateGlossary request = new CreateGlossary().withName(name).withDescription(description);
    if (tags.length > 0) {
      request.withTags(Stream.of(tags).map(ContextFileFqnRepairMigrationIT::tagLabel).toList());
    }
    return ns.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.POST, GLOSSARIES, request, Glossary.class));
  }

  /** A glossary term named like the file under {@code glossary}, holding the file's derived FQN. */
  private static GlossaryTerm createGlossaryTerm(String name, Glossary glossary, String... tags) {
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Named like the file; holds the file's derived FQN");
    if (tags.length > 0) {
      request.withTags(Stream.of(tags).map(ContextFileFqnRepairMigrationIT::tagLabel).toList());
    }
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, GLOSSARY_TERMS, request, GlossaryTerm.class);
  }

  /** The glossary and term a derived-FQN collision with a glossary term needs. */
  private static GlossaryTerm glossaryTermNamedLikeTheFile(
      TestNamespace ns, String folderName, String name) {
    Glossary glossary = createGlossary(ns, folderName, "Named like the file's folder");
    return createGlossaryTerm(name, glossary, OTHER_ENTITY_TAG, FILE_TAG);
  }

  private static List<String> folderTags(Folder folder) {
    return tagFqns(
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET, FOLDERS + "/" + folder.getId() + "?fields=tags", null, Folder.class)
            .getTags());
  }

  private static Folder createFolder(String name, String... tags) {
    CreateFolder request = new CreateFolder().withName(name);
    if (tags.length > 0) {
      request.withTags(Stream.of(tags).map(ContextFileFqnRepairMigrationIT::tagLabel).toList());
    }
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, FOLDERS, request, Folder.class);
  }

  private static Folder createFolder(String name, Folder parent, String... tags) {
    CreateFolder request =
        new CreateFolder().withName(name).withParent(parent.getFullyQualifiedName());
    if (tags.length > 0) {
      request.withTags(Stream.of(tags).map(ContextFileFqnRepairMigrationIT::tagLabel).toList());
    }
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, FOLDERS, request, Folder.class);
  }

  private static TagLabel tagLabel(String tag) {
    return new TagLabel()
        .withTagFQN(tag)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static ContextFile createFile(String name, Folder folder, String tag) {
    CreateContextFile request =
        new CreateContextFile()
            .withName(name)
            .withFileType(ContextFileType.PDF)
            .withProcessingStatus(ProcessingStatus.Uploaded);
    if (folder != null) {
      request.withFolder(folder.getFullyQualifiedName());
    }
    if (tag != null) {
      request.withTags(List.of(tagLabel(tag)));
    }
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, FILES, request, ContextFile.class);
  }

  private static ContextFile getByName(String fqn) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            FILES + "/name/" + encodeURIComponent(fqn) + "?fields=tags,folder",
            null,
            ContextFile.class);
  }

  private static ContextFile getById(UUID id) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, FILES + "/" + id, null, ContextFile.class);
  }
}
