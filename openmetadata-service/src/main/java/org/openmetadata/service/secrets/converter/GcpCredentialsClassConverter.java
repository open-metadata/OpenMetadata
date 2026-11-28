/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.converter;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPExternalAccount;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get an {@link GCPCredentials} object.
 *
 * <p>The {@code gcpConfig} property is a JSON-Schema {@code oneOf} of four branches -- {@link
 * GCPValues} ({@code service_account}), the inline {@code gcp_credential_path}, {@link
 * GCPExternalAccount} ({@code external_account}) and the inline {@code gcp_adc} -- discriminated
 * by the {@code type} field's {@code const} value. Before re-typing, the {@code type} discriminator
 * is consulted so the union branch the user chose is preserved.
 *
 * <p>Without discriminating, an ADC payload (whose {@code type}/{@code projectId} fields also
 * exist on {@link GCPValues}) would bind into {@code GCPValues}, which both violates the {@code
 * gcpValues.json} {@code const: "service_account"} and injects four synthetic Google endpoint
 * defaults from the POJO field initializers ({@code authUri}, {@code tokenUri}, {@code
 * authProviderX509CertUrl}, {@code universeDomain}). A {@code gcp_adc} or {@code
 * gcp_credential_path} payload is therefore left as the {@link java.util.LinkedHashMap} Jackson
 * produced -- exactly what the user submitted, with no branch rewrite and no injected defaults;
 * neither branch declares a {@code format: password} leaf, so nothing escapes masking. The {@code
 * external_account} branch has a generated POJO and is typed into {@link GCPExternalAccount}.
 *
 * <p>{@code GCPValues} is the {@code gcpValues.json} schema default, so a missing or unrecognised
 * {@code type} falls back to {@code GCPValues} -- this keeps the legacy binding for service-account
 * configs and keeps the {@code privateKey} of a {@code service_account} payload reachable by the
 * password masker even when the discriminator is absent. {@link
 * org.openmetadata.service.secrets.converter.NestedSecretConverterCoverageTest} fails if a future
 * secret-bearing branch is added without a converter typing it.
 */
public class GcpCredentialsClassConverter extends ClassConverter {

  /** {@code gcpConfig} {@code oneOf} branches that have a generated POJO, keyed by {@code type}. */
  private static final Map<String, Class<?>> TYPED_BRANCHES =
      Map.of(
          "service_account", GCPValues.class,
          "external_account", GCPExternalAccount.class);

  /**
   * {@code gcpConfig} {@code oneOf} branches that have no generated POJO (their inline definitions
   * declare no {@code javaType}, and extracting them would break the ingestion container's import
   * of {@code GcpADC}/{@code GcpCredentialsPath} from {@code gcpCredentials.py}). They are left
   * untyped so the user's payload is not forced into the wrong branch with injected defaults.
   */
  private static final Set<String> UNTYPED_BRANCHES = Set.of("gcp_adc", "gcp_credential_path");

  /** {@code gcpValues.json} schema default; the fallback for a missing {@code type}. */
  private static final String DEFAULT_TYPE = "service_account";

  public GcpCredentialsClassConverter() {
    super(GCPCredentials.class);
  }

  @Override
  public Object convert(Object object) {
    GCPCredentials gcpCredentials = (GCPCredentials) JsonUtils.convertValue(object, this.clazz);

    Object gcpConfig = gcpCredentials.getGcpConfig();
    if (gcpConfig != null) {
      Class<?> branchClass = resolveBranchClass(gcpConfig);
      if (branchClass != null) {
        tryToConvert(gcpConfig, List.of(branchClass)).ifPresent(gcpCredentials::setGcpConfig);
      }
    }

    return gcpCredentials;
  }

  /**
   * Picks the {@code gcpConfig} {@code oneOf} branch class from the {@code type} discriminator.
   *
   * <p>A {@link java.util.LinkedHashMap} is what Jackson leaves for an untyped {@code Object}
   * property. A {@code gcp_adc} or {@code gcp_credential_path} {@code type} returns {@code null} so
   * the payload is left untyped -- the map the user submitted -- instead of being forced into
   * {@link GCPValues} with injected defaults and a {@code type} that violates its {@code const}. A
   * missing or unrecognised {@code type} falls back to {@code GCPValues}, the {@code gcpValues.json}
   * default, so a {@code service_account} payload's {@code privateKey} is still reachable by the
   * password masker. A value already typed into a branch by a prior conversion keeps that branch
   * class so it round-trips through its own converter.
   */
  private static Class<?> resolveBranchClass(Object gcpConfig) {
    if (gcpConfig instanceof Map<?, ?> map) {
      Object type = map.get("type");
      String typeStr = type == null ? DEFAULT_TYPE : type.toString();
      if (UNTYPED_BRANCHES.contains(typeStr)) {
        return null;
      }
      return TYPED_BRANCHES.getOrDefault(typeStr, GCPValues.class);
    }
    for (Class<?> branchClass : TYPED_BRANCHES.values()) {
      if (branchClass.isInstance(gcpConfig)) {
        return branchClass;
      }
    }
    return null;
  }
}
