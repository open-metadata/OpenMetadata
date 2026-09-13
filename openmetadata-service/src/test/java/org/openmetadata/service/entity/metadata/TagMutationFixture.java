package org.openmetadata.service.entity.metadata;

import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.mockito.invocation.InvocationOnMock;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.EntityUtil;

final class TagMutationFixture implements EntityTagUpdates.Session {
  record Key(String target, String tag, TagSource source) {}

  record Publication(boolean added, TagLabel tag, EntityTagWriter.Target target) {}

  final Map<Key, TagLabel> rows = new HashMap<>();
  final List<Publication> published = new ArrayList<>();
  final List<Runnable> deferred = new ArrayList<>();
  final ChangeDescription changes = new ChangeDescription();
  boolean put = true;
  boolean override;
  boolean selected = true;
  String certification;
  RuntimeException validationFailure;
  RuntimeException writeFailure;
  int writes;
  private final TagUsageDAO dao = mock(TagUsageDAO.class, this::execute);
  final EntityTagWriter writer =
      new EntityTagWriter(
          () -> dao,
          new EntityTagWriter.Rdf(
              (tag, target) -> publish(true, tag, target),
              (tag, target) -> publish(false, tag, target)));
  final EntityTagUpdates updater =
      new EntityTagUpdates(writer, this::validate, () -> certification);

  static TagLabel tag(final String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  void seed(final String fqn, final List<TagLabel> tags) {
    tags.forEach(tag -> store(fqn, tag));
  }

  private void store(final String fqn, final TagLabel tag) {
    rows.put(key(fqn, tag), copy(tag));
  }

  TagLabel stored(final String fqn, final TagLabel tag) {
    return rows.get(key(fqn, tag));
  }

  private Key key(final String fqn, final TagLabel tag) {
    return new Key(fqn, tag.getTagFQN(), tag.getSource());
  }

  private Object execute(final InvocationOnMock invocation) {
    if (writeFailure != null) {
      throw writeFailure;
    }
    writes++;
    switch (invocation.getMethod().getName()) {
      case "applyTag" -> applyOne(invocation);
      case "applyTagsBatch" -> seed(invocation.getArgument(1), invocation.getArgument(0));
      case "deleteTagsBatch" -> delete(invocation.getArgument(1), invocation.getArgument(0));
      case "deleteTagsByTarget" -> rows.keySet()
          .removeIf(key -> key.target().equals(invocation.getArgument(0)));
      case "applyTagsBatchMultiTarget" -> applyMany(invocation.getArgument(0));
      default -> throw new AssertionError("Unexpected tag lookup: " + invocation.getMethod());
    }
    return null;
  }

  private void applyOne(final InvocationOnMock invocation) {
    store(
        invocation.getArgument(3),
        tag(invocation.getArgument(1))
            .withSource(TagSource.values()[invocation.<Integer>getArgument(0)])
            .withLabelType(TagLabel.LabelType.values()[invocation.<Integer>getArgument(4)])
            .withState(TagLabel.State.values()[invocation.<Integer>getArgument(5)])
            .withReason(invocation.getArgument(6))
            .withAppliedBy(invocation.getArgument(7))
            .withMetadata(invocation.getArgument(8)));
  }

  private void applyMany(final Map<String, List<TagLabel>> byTarget) {
    byTarget.forEach(
        (fqn, tags) ->
            seed(
                fqn,
                tags.stream()
                    .filter(tag -> tag.getLabelType() != TagLabel.LabelType.DERIVED)
                    .toList()));
  }

  private void delete(final String fqn, final List<TagLabel> tags) {
    tags.forEach(tag -> rows.remove(key(fqn, tag)));
  }

  private void publish(
      final boolean added, final TagLabel tag, final EntityTagWriter.Target target) {
    published.add(new Publication(added, copy(tag), target));
  }

  private TagLabel copy(final TagLabel tag) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(tag), TagLabel.class);
  }

  private void validate(final List<TagLabel> tags) {
    if (validationFailure != null) {
      throw validationFailure;
    }
  }

  void commitEffects() {
    deferred.forEach(Runnable::run);
    deferred.clear();
  }

  @Override
  public void deferTagEffect(final Runnable effect) {
    deferred.add(effect);
  }

  @Override
  public boolean isPut() {
    return put;
  }

  @Override
  public boolean isOverrideMetadata() {
    return override;
  }

  @Override
  public String updatingUserName() {
    return "ingestion-bot";
  }

  @Override
  public void recordTagChanges(
      final String field, final List<TagLabel> original, final List<TagLabel> updated) {
    if (selected) {
      EntityChangeRecorder.recordList(
          changes,
          field,
          new EntityChangeRecorder.ListChange<>(
              original, updated, new ArrayList<>(), new ArrayList<>(), EntityUtil.tagLabelMatch));
    }
  }
}
