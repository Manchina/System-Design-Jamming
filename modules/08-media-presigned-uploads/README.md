# Chapters 14 & 15: Direct MinIO/S3 Presigned Media Uploads & Async Pipeline

## Architectural Scope
- Direct client-to-storage presigned `PUT` upload URLs, completely offloading heavy network bandwidth from API nodes.
- Expiration and checksum enforcement on upload tokens.
- Event-driven webhook processing notifying backend services upon S3 upload completion.
