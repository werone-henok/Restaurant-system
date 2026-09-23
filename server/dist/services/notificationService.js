import { db } from '../database/schema.js';
import { broadcastEvent } from './websocket.js';
import { v4 as uuidv4 } from 'uuid';
/**
 * Creates notifications for specific roles and broadcasts them via WebSocket.
 */
export function notifyRoles(options) {
    const { branchId = null, targetRoles, title, titleAmharic = null, message, messageAmharic = null, type = 'INFO', linkRef = null } = options;
    const insertNotif = db.prepare(`
    INSERT INTO notifications (id, branch_id, target_role, title, title_amharic, message, message_amharic, type, link_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    for (const role of targetRoles) {
        const notifId = `notif_${uuidv4().substring(0, 8)}`;
        try {
            insertNotif.run(notifId, branchId, role, title, titleAmharic, message, messageAmharic, type, linkRef);
        }
        catch (err) {
            console.warn(`[Notification] Failed to insert notification for role ${role}:`, err);
        }
    }
    // Real-time WebSocket broadcast to all connected clients matching these roles
    broadcastEvent({
        type: 'NOTIFICATION_NEW',
        branchId: branchId || undefined,
        targetRole: targetRoles,
        payload: {
            title,
            titleAmharic,
            message,
            messageAmharic,
            type,
            linkRef,
            createdAt: new Date().toISOString()
        }
    });
}
