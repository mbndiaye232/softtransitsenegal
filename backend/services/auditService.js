const pool = require('../config/database');

/**
 * Service to log user actions in the database
 */
class AuditService {
    /**
     * Log an action
     * @param {Object} params
     * @param {number} params.agent_id - The ID of the agent performing the action
     * @param {number} params.structur_id - The ID of the company
     * @param {string} params.action - CREATE, UPDATE, DELETE, VIEW, etc.
     * @param {string} params.resource_type - DOSSIER, CLIENT, etc.
     * @param {string|number} params.resource_id - ID of the affected resource
     * @param {Object|string} params.details - Additional details (will be stringified if Object)
     * @param {string} params.ip_address - Client IP address
     * @param {string} params.user_agent - Client User Agent
     */
    async log(params) {
        try {
            const {
                agent_id,
                structur_id,
                action,
                resource_type,
                resource_id,
                details,
                ip_address,
                user_agent
            } = params;

            const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;

            await pool.query(
                `INSERT INTO audit_logs (
                    agent_id, 
                    structur_id, 
                    action, 
                    resource_type, 
                    resource_id, 
                    details, 
                    ip_address, 
                    user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [agent_id, structur_id, action, resource_type, resource_id?.toString() || null, detailsStr, ip_address, user_agent]
            );
        } catch (error) {
            console.error('Failed to log audit entry:', error);
            // We don't throw here to avoid breaking the main request flow if logging fails
        }
    }
}

module.exports = new AuditService();
