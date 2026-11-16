import { logger } from "@system-design/shared";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  tier: "free" | "pro" | "enterprise";
  updatedAt: string;
}

export class DatabaseRouter {
  private primaryStore = new Map<string, UserRecord>();
  private replicaStores: Map<string, UserRecord>[] = [
    new Map<string, UserRecord>(),
    new Map<string, UserRecord>(),
  ];
  private nextReplicaIndex = 0;

  constructor() {
    // Seed initial users
    const initialUsers: UserRecord[] = [
      { id: "usr_1", name: "Alice", email: "alice@example.com", tier: "enterprise", updatedAt: new Date().toISOString() },
      { id: "usr_2", name: "Bob", email: "bob@example.com", tier: "pro", updatedAt: new Date().toISOString() },
    ];

    for (const u of initialUsers) {
      this.primaryStore.set(u.id, u);
      for (const r of this.replicaStores) {
        r.set(u.id, { ...u });
      }
    }
  }

  /**
   * Routes write queries strictly to the Primary database.
   */
  public async write(record: UserRecord): Promise<void> {
    logger.info({ id: record.id }, "[DB Router] Writing to PRIMARY database");
    this.primaryStore.set(record.id, record);

    // Simulate async replication lag to replicas (e.g. 5ms)
    setTimeout(() => {
      for (const r of this.replicaStores) {
        r.set(record.id, { ...record });
      }
    }, 5);
  }

  /**
   * Routes read queries across Read Replicas in round-robin fashion.
   */
  public async read(id: string): Promise<UserRecord | null> {
    const replicaIndex = this.nextReplicaIndex;
    this.nextReplicaIndex = (this.nextReplicaIndex + 1) % this.replicaStores.length;

    const replica = this.replicaStores[replicaIndex];
    logger.debug({ id, replicaIndex }, `[DB Router] Reading from REPLICA #${replicaIndex + 1}`);

    const record = replica.get(id);
    return record ? { ...record } : null;
  }
}
