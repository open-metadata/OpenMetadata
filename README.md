
<br /><br />
<p align="center">
    <a href="https://open-metadata.org">
        <img alt="Logo" src="https://github.com/open-metadata/OpenMetadata/assets/40225091/e794ced8-7220-4393-8efc-3faf93bfb503" width="49%">
    </a>
</p>

<p align="center"><b>Empower your Data Journey with OpenMetadata</b></p>


# 📘 **Instructions**

---

Contents:

- [Create entity](#create-entity)
---
## Create entity:

Follow these steps to create and integrate a new entity into **OpenMetadata**.

## **Step 1: Database Bootstrap**

### **SQL Query**
Define the **table structure** with **primary** and **unique** keys. Add the query to the file:
```      
bootstrap/sql/migrations/extension/1.7.0-extension/mysql/schemaChanges.sql
```
### **Configure the Migration Path**
Ensure that in `conf/openmetadata.yaml`, under the `migrationConfiguration` section, the variable `extensionPath` points to the `./bootstrap/sql/migrations/extension` directory.


## **Step 2: Specifications**

### **Entity Spec (JSON Schema)**
Create the **JSON Schema** for the entity at:
```
openmetadata-spec/src/main/resources/json/schema/nu/<initiative>/yourEntity.json
```
### **API Spec**
Create the **JSON Schema** for the API at:
```
openmetadata-spec/src/main/resources/json/schema/api/nu/<initiative>/createYourEntity.json
```

📌 **Note:**
- Use **camelCase** for directories and filenames.
- Ensure **naming consistency** between the entity spec and the API spec.
- Use folders based on the initiative (e.g., `referenceData/`, `frozenSuite/`).

## **Step 3: Build the Server**

After creating the SQL files and specs, **build the server**:

### **Follow the official guide:**
[OpenMetadata Server Build Guide](https://docs.open-metadata.org/v1.5.x/developers/contribute/build-code-and-run-tests/openmetadata-server)

### 📌 **Useful Commands:**
- `mvn clean install -DskipTests` → Build without running tests.
- `./bootstrap/openmetadata-ops.sh migrate --force` → Apply database migrations.
- `./bootstrap/openmetadata-ops.sh drop-create` → Recreate the database from scratch.

## **Step 4: Declare the Entity**
In the `openmetadata-service/src/main/java/org/openmetadata/service/Entity.java` file, declare the new entity:
  ```java
  public static final String <YOURENTITY> = "<yourEntity>";
  ```
---
## 🛠️ **The Service**

- In a typical Java project following a layered architecture, the **Repository**, **Mapper**, and **Resource** play distinct roles in handling data flow and business logic.
--- 

## **Step 5: Create the Repository - Data Access Layer**
The **repository** extends the `EntityRepository` class for communication with the database.

**Purpose:** Handles direct interaction with the database.
### **Location:**
  ```
  openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/nu/<initiative>/YourEntityRepository.java
  ```

### **Example:**
  ```java
  public class YourEntityRepository extends EntityRepository<YourEntity> {
    public YourEntityRepository() {
        super(
                YourEntityResource.COLLECTION_PATH,
                Entity.YOURENTITY,
                YourEntity.class,
                Entity.getCollectionDAO().geoDAO(),
                UPDATE_FIELDS,
                UPDATE_FIELDS);
        supportsSearch = true;
    }
  }
  ```
### 📌 **Key Features:**
- Abstracts database access logic.
- Uses ORM frameworks like JPA/Hibernate.
- Provides methods for querying the database.


## **Step 6: Create the Mapper - Data Access Layer**
The **mapper** converts the `create<Entity>` request into the entity object.

**Purpose:** Handles direct interaction with the database.
### **Location:**
  ```
  openmetadata-service/src/main/java/org/openmetadata/service/resources/nu/<initiative>/YourEntityMapper.java
  ```
### **Example:**
  ```java
  public class YourEntityMapper implements EntityMapper<YourEntity, CreateYourEntity> {

    @Override
    public YourEntity createToEntity(CreateYourEntity create, String user) {

        return copy(new YourEntity(), create, user)
                .withFullyQualifiedName(create.getName());
    }
  }
  ```
### 📌 **Key Features:**
- Separates the domain model from external data representations.
- Enhances code readability and maintainability.



## **Step 7: Create the Resource - Controller Layer**
The **resource** manages **CRUD** operations following REST standards.

**Purpose:** Handles HTTP requests and responses.

### **Location:**
  ```
  openmetadata-service/src/main/java/org/openmetadata/service/resources/nu/<initiative>/YourEntityResource.java
  ```

### **Example:**
```java
@Path("/v1/yourentities")
@Tag(
        name = "YourEntities",
        description = "your description ")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "gyourentities")
public class YourEntityResource extends EntityResource<YourEntity, YourEntityRepository> {
    @GET
    @Path("/nurn/{nurn}")
    @Operation(
            operationId = "getYourEntityByFQN",
            summary = "Get your entity by nurn",
            description = "Get your entity by `nurn`.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "your description",
                            content =
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = YourEntity.class))),
                    @ApiResponse(responseCode = "404", description = "{nurn} is not found")
            })
    public YourEntity getByNuRN(
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext,
            @Parameter(description = "NuRN of your entity", schema = @Schema(type = "string"))
            @PathParam("nurn")
            String nurn,
            @Parameter(
                    description = "Include all, deleted, or non-deleted entities.",
                    schema = @Schema(implementation = Include.class))
            @QueryParam("include")
            @DefaultValue("non-deleted")
            Include include) {
        return getByNameInternal(
                uriInfo, securityContext, EntityInterfaceUtil.quoteName(nurn), "", include);
    }   
} 
```
### 📌 **Key Features:**
- Exposes RESTful APIs.
- Handles request validation and response formatting.
- Uses ResponseEntity for proper HTTP status codes.

---

## ✅ **Best Practices**
- Use **camelCase** for JSON files and **PascalCase** for Java classes.
- Keep the folder structure consistent across initiatives.
- Refer to existing entities when in doubt.

---
___
