package org.openmetadata.service.ontology;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

/** Canonical members and a bounded, database-independent release manifest. */
public final class OntologyReleaseManifest {
  public static final String ENCODING_VERSION = "ontology-release-v1";
  public static final int MAX_MEMBER_BYTES = 1_048_576;
  public static final int MAX_MEMBERS = 10_000;
  public static final long MAX_RELEASE_BYTES = 67_108_864L;

  private OntologyReleaseManifest() {}

  public static void verify(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    if (release == null
        || release.getId() == null
        || release.getSealedAt() == null
        || release.getOntology() == null
        || release.getOntology().getId() == null
        || release.getOntologyIri() == null
        || release.getEncodingVersion() == null
        || !ENCODING_VERSION.equals(release.getEncodingVersion().value())
        || release.getVersionIri() == null
        || !("urn:openmetadata:ontology-release:" + release.getId())
            .equals(release.getVersionIri().toString())) {
      throw new BadRequestException("A supported sealed ontology release is required");
    }
    final String digest = digest(members);
    final long bytes = members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum();
    if (!Objects.equals(release.getContentDigest(), digest)
        || !Objects.equals(release.getMemberCount(), members.size())
        || !Objects.equals(release.getTotalBytes(), bytes)
        || members.stream().anyMatch(member -> !release.getId().equals(member.getReleaseId()))) {
      throw new BadRequestException("Ontology release manifest integrity check failed");
    }
  }

  public static OntologyReleaseMember member(
      final UUID releaseId, final MemberKind kind, final UUID id, final JsonNode payload) {
    if (releaseId == null || kind == null || id == null || payload == null || !payload.isObject()) {
      throw new BadRequestException("A release member requires an identity and an object payload");
    }
    final JsonNode canonical = canonicalPayload(kind, payload);
    final String json = canonical.toString();
    final byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
    if (bytes.length > MAX_MEMBER_BYTES) {
      throw new BadRequestException("An ontology release member exceeds the 1 MiB limit");
    }
    return new OntologyReleaseMember()
        .withReleaseId(releaseId)
        .withMemberKind(kind)
        .withMemberId(id)
        .withSourceVersion(payload.hasNonNull("version") ? payload.get("version").asDouble() : null)
        .withPayload(canonical)
        .withPayloadDigest(DigestUtils.sha256Hex(bytes))
        .withPayloadBytes((long) bytes.length);
  }

  static JsonNode canonicalPayload(final MemberKind kind, final JsonNode payload) {
    final ObjectNode source = ((ObjectNode) payload).deepCopy();
    if (kind == MemberKind.CONCEPT) {
      source.remove(List.of("superClasses", "subClasses"));
    }
    final JsonNode canonical = OntologyJson.canonical(source);
    requireSupportedText(canonical);
    return canonical;
  }

  private static void requireSupportedText(final JsonNode value) {
    if (value.isTextual()) {
      requireSupportedText(value.textValue());
    }
    value.properties().forEach(entry -> requireSupportedText(entry.getKey()));
    value.forEach(OntologyReleaseManifest::requireSupportedText);
  }

  private static void requireSupportedText(final String value) {
    if (value.indexOf('\u0000') >= 0) {
      throw new BadRequestException("Ontology release content cannot contain NUL characters");
    }
  }

  public static String digest(final List<OntologyReleaseMember> members) {
    if (members == null || members.isEmpty() || members.size() > MAX_MEMBERS) {
      throw new BadRequestException("An ontology release requires between 1 and 10000 members");
    }
    for (final OntologyReleaseMember member : members) {
      if (member == null || member.getMemberKind() == null || member.getMemberId() == null) {
        throw new BadRequestException("A release member requires an identity");
      }
    }
    final List<OntologyReleaseMember> ordered =
        members.stream()
            .sorted(
                Comparator.comparing(
                        (OntologyReleaseMember member) -> member.getMemberKind().name())
                    .thenComparing(member -> member.getMemberId().toString()))
            .toList();
    return digestOrdered(ordered);
  }

  private static String digestOrdered(final List<OntologyReleaseMember> members) {
    final MessageDigest digest = DigestUtils.getSha256Digest();
    digest.update((ENCODING_VERSION + '\n').getBytes(StandardCharsets.UTF_8));
    long totalBytes = 0;
    OntologyReleaseMember previous = null;
    for (final OntologyReleaseMember member : members) {
      requireValidMember(member, previous);
      totalBytes += member.getPayloadBytes();
      if (totalBytes > MAX_RELEASE_BYTES) {
        throw new BadRequestException("Ontology release content exceeds the 64 MiB limit");
      }
      final ObjectNode entry = JsonUtils.getObjectMapper().valueToTree(member);
      entry.remove(List.of("releaseId", "payload"));
      digest.update(OntologyJson.canonical(entry).toString().getBytes(StandardCharsets.UTF_8));
      digest.update((byte) '\n');
      previous = member;
    }
    return HexFormat.of().formatHex(digest.digest());
  }

  public static void verifyMember(final OntologyReleaseMember member) {
    requireValidMember(member, null);
  }

  private static void requireValidMember(
      final OntologyReleaseMember member, final OntologyReleaseMember previous) {
    final OntologyReleaseMember expected =
        member(
            member.getReleaseId(),
            member.getMemberKind(),
            member.getMemberId(),
            member.getPayload());
    if (!Objects.equals(member.getPayloadDigest(), expected.getPayloadDigest())
        || !Objects.equals(member.getPayloadBytes(), expected.getPayloadBytes())
        || (member.getPayload().hasNonNull("version")
            && !Objects.equals(member.getSourceVersion(), expected.getSourceVersion()))) {
      throw new BadRequestException("Ontology release member integrity check failed");
    }
    if (previous != null
        && (!Objects.equals(previous.getReleaseId(), member.getReleaseId())
            || (previous.getMemberKind() == member.getMemberKind()
                && previous.getMemberId().equals(member.getMemberId())))) {
      throw new BadRequestException("Release members must have unique identities and one release");
    }
  }
}
