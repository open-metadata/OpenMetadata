package org.openmetadata.service.jdbi3;

import java.util.UUID;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.type.ProviderType;

public interface AuthenticationConfigDAO {
    @SqlQuery("SELECT config_value FROM authentication_config WHERE provider = :provider")
    String getConfigByProvider(@Bind("provider") String provider);

    @SqlUpdate(
        "INSERT INTO authentication_config (id, provider, config_type, config_value, encrypted_fields, created_by) " +
        "VALUES (:id, :provider, :configType, :configValue, :encryptedFields, :createdBy)")
    void insert(
        @Bind("id") UUID id,
        @Bind("provider") String provider,
        @Bind("configType") String configType,
        @Bind("configValue") String configValue,
        @Bind("encryptedFields") String encryptedFields,
        @Bind("createdBy") String createdBy);

    @SqlUpdate(
        "UPDATE authentication_config SET config_value = :configValue, encrypted_fields = :encryptedFields, " +
        "updated_by = :updatedBy WHERE provider = :provider")
    void update(
        @Bind("provider") String provider,
        @Bind("configValue") String configValue,
        @Bind("encryptedFields") String encryptedFields,
        @Bind("updatedBy") String updatedBy);

    @SqlQuery("SELECT EXISTS(SELECT 1 FROM authentication_config WHERE provider = :provider)")
    boolean exists(@Bind("provider") String provider);

    @SqlUpdate("DELETE FROM authentication_config WHERE provider = :provider")
    void delete(@Bind("provider") String provider);
} 