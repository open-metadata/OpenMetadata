package org.openmetadata.schema;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.text.Format;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;

public interface EntityTimeSeriesInterface {
  Map<String, String> CANONICAL_ENTITY_NAME_MAP = new HashMap<>();
  Map<String, Class<? extends EntityTimeSeriesInterface>> ENTITY_TYPE_TO_CLASS_MAP = new HashMap<>();

  UUID getId();

  Long getTimestamp();

  void setId(UUID id);

  @JsonIgnore
  default Date getDateParsedTimestamp() {
    return new Date(getTimestamp());
  }

  @JsonIgnore
  default String getStrParsedTimestamp() {
    Date date = new Date(getTimestamp());
    Format formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    return formatter.format(date);
  }

  @JsonIgnore
  default String getIso8601StrDate() {
    Date date = new Date(getTimestamp());
    Format formatter = new SimpleDateFormat("yyyy-MM-dd");
    return formatter.format(date);
  }

  @JsonIgnore
  default EntityReference getEntityReference() {
    return new EntityReference()
      .withId(getId())
      .withType(CANONICAL_ENTITY_NAME_MAP.get(this.getClass().getSimpleName().toLowerCase(Locale.ROOT)));
  }
}
