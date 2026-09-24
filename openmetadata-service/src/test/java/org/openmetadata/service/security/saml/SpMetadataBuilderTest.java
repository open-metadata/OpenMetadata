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

package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import com.onelogin.saml2.util.Constants;
import com.onelogin.saml2.util.Util;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

class SpMetadataBuilderTest {

  private static final String IDP_ENTITY_ID = "https://idp.example.com/metadata";
  private static final String SP_ENTITY_ID = "https://om.example.com/api/v1/saml/metadata";
  private static final String PRIMARY_ACS = "https://om.example.com/api/v1/saml/acs";
  private static final String DR_ACS = "https://dr.example.com/api/v1/saml/acs";
  private static final String LB_ACS = "https://lb.example.com/api/v1/saml/acs";
  private static final String CERTIFICATE = "/saml/mock-idp.crt";
  private static final String PRIVATE_KEY = "/saml/mock-idp-pkcs8.key";
  private static final String SIGNATURE_XPATH = "/md:EntityDescriptor/ds:Signature";

  /** Existing single-host deployments must not see their registered metadata change. */
  @Test
  void servesTheLibraryMetadataWhenNoAdditionalAcsIsConfigured() throws Exception {
    Saml2Settings settings = settings(false);

    String metadata = SpMetadataBuilder.build(settings, List.of());

    assertEquals(List.of(PRIMARY_ACS), acsAttribute(metadata, "Location"));
    assertEquals(
        withoutPerCallAttributes(settings.getSPMetadata()), withoutPerCallAttributes(metadata));
  }

  @Test
  void advertisesEveryAcsUnderOneEntityId() throws Exception {
    String metadata = SpMetadataBuilder.build(settings(false), List.of(DR_ACS, LB_ACS));

    assertEquals(List.of(PRIMARY_ACS, DR_ACS, LB_ACS), acsAttribute(metadata, "Location"));
    assertEquals(List.of("1", "2", "3"), acsAttribute(metadata, "index"));
    NodeList descriptors =
        Util.loadXML(metadata).getElementsByTagNameNS(Constants.NS_MD, "EntityDescriptor");
    assertEquals(1, descriptors.getLength());
    assertEquals(SP_ENTITY_ID, ((Element) descriptors.item(0)).getAttribute("entityID"));
  }

  /** The additional endpoints are added before signing, so altering one breaks the signature. */
  @Test
  void signsTheMetadataIncludingTheAdditionalAcs() throws Exception {
    String metadata = SpMetadataBuilder.build(settings(true), List.of(DR_ACS));
    X509Certificate certificate = Util.loadCert(resource(CERTIFICATE));

    assertTrue(Util.validateSign(Util.loadXML(metadata), certificate, null, null, SIGNATURE_XPATH));
    String tampered = metadata.replace(DR_ACS, "https://evil.example.com/api/v1/saml/acs");
    assertFalse(
        Util.validateSign(Util.loadXML(tampered), certificate, null, null, SIGNATURE_XPATH));
  }

  private static List<String> acsAttribute(String metadata, String attribute) {
    Document document = Util.loadXML(metadata);
    NodeList acsElements =
        document.getElementsByTagNameNS(Constants.NS_MD, "AssertionConsumerService");
    List<String> values = new ArrayList<>();
    for (int i = 0; i < acsElements.getLength(); i++) {
      values.add(((Element) acsElements.item(i)).getAttribute(attribute));
    }
    return values;
  }

  private static String withoutPerCallAttributes(String metadata) {
    return metadata.replaceAll("\\s(ID|validUntil)=\"[^\"]*\"", "");
  }

  private Saml2Settings settings(boolean signMetadata) throws IOException {
    Map<String, Object> values = new HashMap<>();
    values.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, SP_ENTITY_ID);
    values.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, PRIMARY_ACS);
    values.put(
        SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST");
    values.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, IDP_ENTITY_ID);
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY, "https://idp.example.com/sso");
    values.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, resource(CERTIFICATE));
    values.put(SettingsBuilder.SECURITY_SIGN_METADATA, signMetadata);
    if (signMetadata) {
      values.put(SettingsBuilder.SP_X509CERT_PROPERTY_KEY, resource(CERTIFICATE));
      values.put(SettingsBuilder.SP_PRIVATEKEY_PROPERTY_KEY, resource(PRIVATE_KEY));
    }
    return new SettingsBuilder().fromValues(values).build();
  }

  private String resource(String path) throws IOException {
    try (InputStream stream = getClass().getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
