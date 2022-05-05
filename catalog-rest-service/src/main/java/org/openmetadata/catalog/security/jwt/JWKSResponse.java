package org.openmetadata.catalog.security.jwt;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class JWKSResponse {
  @JsonProperty("keys")
  @NotEmpty
  @Getter
  @Setter
  List<JWKSKey> jwsKeys;
}
