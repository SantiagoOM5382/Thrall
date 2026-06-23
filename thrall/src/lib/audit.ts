import type { DB } from '../db/client'
import { auditLogs } from '../db/schema'
import { newId } from './ulid'

export async function logAudit(
  db: DB,
  params: {
    userId: string
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    entity: string
    entityId: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await db.insert(auditLogs).values({
    id: newId(),
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: Date.now(),
  })
}
