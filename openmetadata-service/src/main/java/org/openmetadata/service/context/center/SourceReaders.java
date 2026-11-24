package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.drive.ContextFileVisibility;

/**
 * Who may read the documents a memory states. A file whose sharing the running write changes is
 * read as that write leaves it, because the store, and any cache, still hold its old sharing.
 */
final class SourceReaders {
  private final Map<UUID, ContextFile> sharingChanges;

  SourceReaders() {
    this(Map.of());
  }

  private SourceReaders(Map<UUID, ContextFile> sharingChanges) {
    this.sharingChanges = sharingChanges;
  }

  SourceReaders withSharingOf(ContextFile file) {
    return new SourceReaders(Map.of(file.getId(), file));
  }

  /** A live article, or a file shared with the whole organization ({@link MemorySourceDisclosure}). */
  boolean everyoneMayRead(EntityReference document) {
    ContextFile changing = sharingChanges.get(document.getId());
    return changing == null
        ? MemorySourceDisclosure.everyoneMayRead(document)
        : ContextFileVisibility.isOrgWide(changing);
  }

  /**
   * The ids of the people a restricted file lets read it: its user owners, and the principals it
   * names when it is shared. Teams are not expanded, so a member reached only through a team is not
   * among them.
   */
  Set<UUID> readersOf(EntityReference file) {
    ContextFile sharing = sharingOf(file);
    Stream<EntityReference> owners =
        listOrEmpty(sharing.getOwners()).stream()
            .filter(owner -> Entity.USER.equals(owner.getType()));
    return Stream.concat(owners, sharedWith(sharing))
        .map(EntityReference::getId)
        .collect(Collectors.toSet());
  }

  private ContextFile sharingOf(EntityReference file) {
    ContextFile changing = sharingChanges.get(file.getId());
    return changing != null
        ? changing
        : Entity.getEntity(file, Entity.FIELD_OWNERS, Include.NON_DELETED);
  }

  /** Who a Shared file names; a Private file names nobody, whatever its list still holds. */
  private static Stream<EntityReference> sharedWith(ContextFile file) {
    boolean shared =
        file.getShareConfig() != null
            && file.getShareConfig().getVisibility() == MemoryVisibility.SHARED;
    return shared
        ? listOrEmpty(file.getShareConfig().getSharedWith()).stream()
            .map(MemorySharedPrincipal::getPrincipal)
            .filter(Objects::nonNull)
        : Stream.empty();
  }
}
