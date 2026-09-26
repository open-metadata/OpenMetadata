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

import com.onelogin.saml2.settings.Metadata;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.util.Constants;
import com.onelogin.saml2.util.Util;
import java.security.cert.CertificateEncodingException;
import java.util.List;
import javax.xml.xpath.XPathExpressionException;
import lombok.extern.slf4j.Slf4j;
import org.apache.xml.security.exceptions.XMLSecurityException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Service Provider metadata that advertises every configured Assertion Consumer Service under the
 * one entity ID.
 *
 * <p>onelogin's metadata template holds a single ACS, and it runs {@code postProcessXml} from inside
 * the {@code Metadata} constructors, before a subclass could hold the extra URLs. The additional
 * endpoints are therefore added to the rendered document, which is signed afterwards so the
 * signature covers them.
 */
@Slf4j
public final class SpMetadataBuilder {
  private static final String ACS_ELEMENT = "AssertionConsumerService";

  private SpMetadataBuilder() {}

  /** Without additional ACS URLs this is exactly {@link Saml2Settings#getSPMetadata()}. */
  public static String build(Saml2Settings settings, List<String> additionalAcsUrls)
      throws CertificateEncodingException {
    return additionalAcsUrls.isEmpty()
        ? settings.getSPMetadata()
        : buildWithAdditionalAcs(settings, additionalAcsUrls);
  }

  private static String buildWithAdditionalAcs(
      Saml2Settings settings, List<String> additionalAcsUrls) throws CertificateEncodingException {
    String metadata =
        withAdditionalAcs(
            new Metadata(settings).getMetadataString(),
            settings.getSpAssertionConsumerServiceBinding(),
            additionalAcsUrls);
    return settings.getSignMetadata() ? sign(metadata, settings) : metadata;
  }

  private static String withAdditionalAcs(String metadata, String binding, List<String> acsUrls) {
    Document document = Util.loadXML(metadata);
    NodeList acsElements = document.getElementsByTagNameNS(Constants.NS_MD, ACS_ELEMENT);
    Element lastAcs = (Element) acsElements.item(acsElements.getLength() - 1);
    Node insertBefore = lastAcs.getNextSibling();
    int nextIndex = acsElements.getLength() + 1;
    for (String acsUrl : acsUrls) {
      Element acs = document.createElementNS(Constants.NS_MD, lastAcs.getTagName());
      acs.setAttribute("Binding", binding);
      acs.setAttribute("Location", acsUrl);
      acs.setAttribute("index", String.valueOf(nextIndex++));
      lastAcs.getParentNode().insertBefore(acs, insertBefore);
    }
    return Util.convertDocumentToString(document);
  }

  /** Like {@link Saml2Settings#getSPMetadata()}, a signing failure serves the metadata unsigned. */
  private static String sign(String metadata, Saml2Settings settings) {
    try {
      return Metadata.signMetadata(
          metadata,
          settings.getSPkey(),
          settings.getSPcert(),
          settings.getSignatureAlgorithm(),
          settings.getDigestAlgorithm());
    } catch (XPathExpressionException | XMLSecurityException e) {
      LOG.warn("Could not sign the SP metadata; serving it unsigned", e);
      return metadata;
    }
  }
}
