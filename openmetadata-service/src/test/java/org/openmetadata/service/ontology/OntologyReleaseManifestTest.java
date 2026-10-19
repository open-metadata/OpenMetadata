package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class OntologyReleaseManifestTest {
  private static final UUID RELEASE = UUID.fromString("916e6b9f-ea75-41a8-bd77-b81a04879243");
  private static final UUID MEMBER = UUID.fromString("7f4ef690-aedc-4ed4-b00b-41cd042f24b4");

  @Test
  void memberDigestsIgnoreJsonObjectOrderButPreserveIriSpelling() {
    OntologyReleaseMember first =
        member("{\"name\":\"Customer\",\"iri\":\"HTTPS://EXAMPLE.org/客户\"}");
    OntologyReleaseMember reordered =
        member("{\"iri\":\"HTTPS://EXAMPLE.org/客户\",\"name\":\"Customer\"}");
    OntologyReleaseMember distinct =
        member("{\"iri\":\"https://example.org/客户\",\"name\":\"Customer\"}");

    assertEquals(first.getPayloadDigest(), reordered.getPayloadDigest());
    assertNotEquals(first.getPayloadDigest(), distinct.getPayloadDigest());
    assertEquals("HTTPS://EXAMPLE.org/客户", first.getPayload().path("iri").asText());
  }

  @Test
  void memberDigestsPreserveArrayOrderAndNumericValuesAcrossJsonStorage() {
    assertEquals(
        member("{\"cardinality\":1.0}").getPayloadDigest(),
        member("{\"cardinality\":1}").getPayloadDigest());
    assertNotEquals(
        member("{\"propertyChain\":[\"urn:first\",\"urn:second\"]}").getPayloadDigest(),
        member("{\"propertyChain\":[\"urn:second\",\"urn:first\"]}").getPayloadDigest());
  }

  @Test
  void manifestsAreIndependentOfDatabaseReadOrderAndBindMemberIdentity() {
    OntologyReleaseMember concept = member("{\"iri\":\"urn:Customer\"}");
    OntologyReleaseMember property =
        OntologyReleaseManifest.member(
            RELEASE, MemberKind.PROPERTY, MEMBER, JsonUtils.readTree("{\"iri\":\"urn:knows\"}"));
    assertEquals(
        OntologyReleaseManifest.digest(List.of(concept, property)),
        OntologyReleaseManifest.digest(List.of(property, concept)));
    assertNotEquals(
        OntologyReleaseManifest.digest(List.of(concept)),
        OntologyReleaseManifest.digest(List.of(property)));
    assertThrows(
        BadRequestException.class, () -> OntologyReleaseManifest.digest(List.of(concept, concept)));
  }

  @Test
  void oversizedPayloadsAreRejectedBeforeStorage() {
    String payload =
        "{\"description\":\"" + "x".repeat(OntologyReleaseManifest.MAX_MEMBER_BYTES) + "\"}";
    assertThrows(BadRequestException.class, () -> member(payload));
  }

  @Test
  void rejectsPayloadsThatDatabaseBindingWouldChange() {
    assertThrows(BadRequestException.class, () -> member("{\"label\":\"a\\u0000b\"}"));
    assertEquals(
        "a\\u0000b", member("{\"label\":\"a\\\\u0000b\"}").getPayload().path("label").asText());
    assertDoesNotThrow(() -> member("{\"label\":\"a\\\\u0000b\",\"cardinality\":100.0}"));
  }

  @Test
  void rejectsMissingMemberIdentityAndInvalidManifests() {
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyReleaseManifest.member(
                null, MemberKind.CONCEPT, MEMBER, JsonUtils.readTree("{}")));
    assertThrows(
        BadRequestException.class,
        () -> OntologyReleaseManifest.member(RELEASE, null, MEMBER, JsonUtils.readTree("{}")));
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyReleaseManifest.member(
                RELEASE, MemberKind.CONCEPT, null, JsonUtils.readTree("{}")));
    assertThrows(BadRequestException.class, () -> member("[]"));
    assertThrows(
        BadRequestException.class,
        () -> OntologyReleaseManifest.member(RELEASE, MemberKind.CONCEPT, MEMBER, null));
    assertThrows(BadRequestException.class, () -> OntologyReleaseManifest.digest(null));
    assertThrows(BadRequestException.class, () -> OntologyReleaseManifest.digest(List.of()));
    assertThrows(
        BadRequestException.class,
        () -> OntologyReleaseManifest.digest(Collections.singletonList(null)));
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyReleaseManifest.digest(
                Collections.nCopies(OntologyReleaseManifest.MAX_MEMBERS + 1, member("{}"))));
  }

  @Test
  void rejectsChangedPayloadOrProvenanceAndMixedReleases() {
    OntologyReleaseMember member =
        member("{\"version\":0.2,\"reviewRevision\":3,\"iri\":\"urn:Customer\"}");
    String digest = member.getPayloadDigest();
    member.setPayloadDigest("0".repeat(64));
    assertThrows(BadRequestException.class, () -> OntologyReleaseManifest.digest(List.of(member)));
    member.withPayloadDigest(digest).withSourceVersion(0.3);
    assertThrows(BadRequestException.class, () -> OntologyReleaseManifest.digest(List.of(member)));
    member.withSourceVersion(0.2).withPayloadBytes(member.getPayloadBytes() + 1);
    assertThrows(BadRequestException.class, () -> OntologyReleaseManifest.digest(List.of(member)));
    OntologyReleaseMember anotherRelease =
        member("{}").withReleaseId(UUID.randomUUID()).withMemberId(UUID.randomUUID());
    assertThrows(
        BadRequestException.class,
        () -> OntologyReleaseManifest.digest(List.of(member("{}"), anotherRelease)));
  }

  @Test
  void limitsTotalCapturedBytes() {
    String payload =
        "{\"description\":\"" + "x".repeat(OntologyReleaseManifest.MAX_MEMBER_BYTES - 100) + "\"}";
    List<OntologyReleaseMember> members =
        IntStream.range(0, 65)
            .mapToObj(index -> member(payload).withMemberId(new UUID(0, index)))
            .toList();
    assertThrows(BadRequestException.class, () -> OntologyReleaseManifest.digest(members));
  }

  private static OntologyReleaseMember member(String json) {
    return OntologyReleaseManifest.member(
        RELEASE, MemberKind.CONCEPT, MEMBER, JsonUtils.readTree(json));
  }

  @Test
  void derivedHierarchyDoesNotEnterTheSealedPayloadOrItsDigest() {
    final var plain = member("{\"iri\":\"urn:Customer\"}");
    final var derived =
        member("{\"iri\":\"urn:Customer\",\"superClasses\":[\"urn:Party\"],\"subClasses\":[]}");
    assertEquals(plain.getPayload(), derived.getPayload());
    assertEquals(plain.getPayloadDigest(), derived.getPayloadDigest());
    assertEquals(
        OntologyReleaseManifest.digest(List.of(plain)),
        OntologyReleaseManifest.digest(List.of(derived)));
  }
}
