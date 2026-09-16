package org.openmetadata.service.resources.drive;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.attachments.AssetType;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Shared helpers for attachment/asset upload flows. Promoted to {@code public} so the
 * attachments resource (a different package) can reuse the streaming upload buffer and
 * the Content-Disposition sanitization without duplicating them.
 */
public final class ContextFileUploadSupport {
  private static final String CONTEXT_FILE_ENTITY = "contextFile";

  public static final class MaxFileSizeExceededException extends IOException {
    private final long actualSize;
    private final long maxFileSize;

    MaxFileSizeExceededException(long actualSize, long maxFileSize) {
      super(
          String.format("File size %d exceeds configured limit %d bytes", actualSize, maxFileSize));
      this.actualSize = actualSize;
      this.maxFileSize = maxFileSize;
    }

    public long getActualSize() {
      return actualSize;
    }

    public long getMaxFileSize() {
      return maxFileSize;
    }
  }

  public static final class BufferedUpload implements AutoCloseable {
    private final Path path;
    private final long size;
    private final String checksum;

    BufferedUpload(Path path, long size, String checksum) {
      this.path = path;
      this.size = size;
      this.checksum = checksum;
    }

    public long getSize() {
      return size;
    }

    public String getChecksum() {
      return checksum;
    }

    public InputStream newInputStream() throws IOException {
      return Files.newInputStream(path);
    }

    @Override
    public void close() throws IOException {
      Files.deleteIfExists(path);
    }
  }

  private ContextFileUploadSupport() {}

  static boolean exceedsMaxFileSize(long fileSize, long maxFileSize) {
    return maxFileSize > 0 && fileSize > maxFileSize;
  }

  static String sanitizeEntityName(String originalFileName) {
    // Multipart uploads can arrive with missing or blank filename metadata. Fall back
    // to a stable base so the upload does not fail with NullPointerException.
    String source =
        (originalFileName == null || originalFileName.isBlank()) ? "file" : originalFileName;
    String sanitized =
        source.replaceAll("[^a-zA-Z0-9._-]", "_").replaceAll("_+", "_").toLowerCase();
    if (sanitized.isEmpty()) {
      sanitized = "file";
    }
    if (sanitized.length() > 180) {
      sanitized = sanitized.substring(0, 180);
    }
    return sanitized;
  }

  static ContextFileType detectFileType(String contentType) {
    if (contentType == null) {
      return ContextFileType.Other;
    }
    String ct = contentType.toLowerCase();
    if (ct.equals("application/pdf")) {
      return ContextFileType.PDF;
    }
    if (ct.contains("spreadsheet") || ct.contains("excel")) {
      return ContextFileType.Spreadsheet;
    }
    if (ct.contains("presentation") || ct.contains("powerpoint")) {
      return ContextFileType.Presentation;
    }
    if (ct.startsWith("image/")) {
      return ContextFileType.Image;
    }
    if (ct.equals("text/csv") || ct.equals("application/csv")) {
      return ContextFileType.CSV;
    }
    if (ct.contains("document") || ct.contains("word")) {
      return ContextFileType.Document;
    }
    if (ct.startsWith("text/")) {
      return ContextFileType.Text;
    }
    return ContextFileType.Other;
  }

  static String buildEntityLink(ContextFile file) {
    return "<#E::" + CONTEXT_FILE_ENTITY + "::" + file.getFullyQualifiedName() + ">";
  }

  /**
   * Safe-for-{@code Content-Disposition} rendering of {@code fileName}. Strips the
   * characters that would let a hostile filename break out of the header
   * ({@code "}, {@code \}, CR, LF) and falls back to {@code "download"} if the
   * sanitized form is empty. Shared with the attachments resource so both upload/download
   * paths apply the same protection.
   */
  public static String sanitizeFileName(String fileName) {
    if (fileName == null) {
      return "download";
    }
    String sanitized = fileName.replaceAll("[\"\\\\\\r\\n]", "_").trim();
    return sanitized.isEmpty() ? "download" : sanitized;
  }

  /**
   * Build a {@code Content-Disposition} header value that is safe for non-ASCII
   * filenames. Emits both the legacy quoted {@code filename=} parameter (for older
   * clients) and the RFC 5987 {@code filename*=UTF-8''...} parameter with
   * percent-encoded bytes — so international filenames round-trip while remaining
   * header-injection safe.
   */
  public static String buildContentDisposition(String fileName) {
    String safeAscii = sanitizeFileName(fileName);
    String encoded = URLEncoder.encode(safeAscii, StandardCharsets.UTF_8).replace("+", "%20");
    return "attachment; filename=\"" + safeAscii + "\"; filename*=UTF-8''" + encoded;
  }

  public static BufferedUpload bufferUpload(InputStream inputStream, long maxFileSize)
      throws IOException {
    Path tempFile = Files.createTempFile("context-file-upload-", ".bin");
    MessageDigest digest = sha256Digest();
    long totalBytes = 0L;
    byte[] buffer = new byte[8192];

    try (OutputStream outputStream = Files.newOutputStream(tempFile)) {
      int bytesRead;
      while ((bytesRead = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, bytesRead);
        digest.update(buffer, 0, bytesRead);
        totalBytes += bytesRead;
        if (exceedsMaxFileSize(totalBytes, maxFileSize)) {
          throw new MaxFileSizeExceededException(totalBytes, maxFileSize);
        }
      }
      return new BufferedUpload(tempFile, totalBytes, HexFormat.of().formatHex(digest.digest()));
    } catch (IOException | RuntimeException e) {
      Files.deleteIfExists(tempFile);
      throw e;
    }
  }

  static Asset buildAsset(
      ContextFile file,
      String originalFileName,
      String contentType,
      String fileExtension,
      long fileSize,
      String updatedBy) {
    Asset asset = new Asset();
    String entityLink = buildEntityLink(file);
    MessageParser.EntityLink assetLink = MessageParser.EntityLink.parse(entityLink);
    asset.setId(UUID.randomUUID().toString());
    asset.setFileName(originalFileName);
    asset.setContentType(contentType);
    asset.setSize(Math.toIntExact(fileSize));
    asset.setEntityLink(entityLink);
    asset.setFullyQualifiedName(assetLink.getEntityFQN());
    asset.setUrl("");
    asset.setAssetType(AssetType.External);
    asset.setExtension(fileExtension);
    asset.setUpdatedBy(updatedBy);
    asset.setUpdatedAt(System.currentTimeMillis());
    asset.setDeleted(false);
    return asset;
  }

  static ContextFileContent buildContent(
      ContextFile file, Asset asset, String checksum, String updatedBy) {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    return new ContextFileContent()
        .withId(UUID.randomUUID())
        .withName(file.getName() + "_content_" + suffix)
        .withContextFile(file.getEntityReference())
        .withAssetId(asset.getId())
        .withContentType(asset.getContentType())
        .withSize(asset.getSize())
        .withChecksum(checksum)
        .withIngestedAt(System.currentTimeMillis())
        .withIsCurrent(true)
        .withProcessingStatus(ProcessingStatus.Uploaded)
        .withUpdatedBy(updatedBy)
        .withUpdatedAt(System.currentTimeMillis())
        .withDeleted(false);
  }

  static String sha256(byte[] content) {
    return HexFormat.of().formatHex(sha256Digest().digest(content));
  }

  private static MessageDigest sha256Digest() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is required for ContextFile content checksums", e);
    }
  }
}
