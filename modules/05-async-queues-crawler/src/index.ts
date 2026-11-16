// BullMQ Worker & Crawler Pipeline stub (Chapters 9-10)
export interface CrawlJobData {
  url: string;
  depth: number;
  idempotencyKey: string;
}
