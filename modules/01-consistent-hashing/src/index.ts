// Consistent Hashing Ring implementation stub (Chapter 5)
export interface HashNode {
  id: string;
  host: string;
  port: number;
}

export class ConsistentHashRing {
  constructor(public virtualNodes = 150) {}
  // Implementation will be completed in Week 1
}
