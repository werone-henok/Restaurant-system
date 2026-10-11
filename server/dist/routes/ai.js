import { Router } from 'express';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { gatherBusinessMetrics, generateExecutiveInsights, processAiQuery } from '../services/aiService.js';
export const aiRouter = Router();
// Protect all AI endpoints for Admin & Owner only
aiRouter.use(authenticate);
aiRouter.use(authorizeRole(['admin', 'owner']));
/**
 * GET /api/ai/insights
 * Returns real-time business health metrics and proactive AI insights
 */
aiRouter.get('/insights', async (req, res) => {
    try {
        const branchId = req.query.branchId || (req.user?.branch_id ?? undefined);
        const metrics = gatherBusinessMetrics(branchId);
        const insights = generateExecutiveInsights(metrics);
        res.json({
            success: true,
            metrics,
            insights,
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        console.error('[AI] Failed to compute insights:', err);
        res.status(500).json({ error: 'Failed to generate AI executive insights' });
    }
});
/**
 * POST /api/ai/chat
 * Natural language interactive Business Intelligence Copilot
 */
aiRouter.post('/chat', async (req, res) => {
    try {
        const { message, branchId } = req.body;
        const targetBranch = branchId || req.user?.branch_id || undefined;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message query is required' });
        }
        const result = await processAiQuery(message, targetBranch);
        res.json({
            success: true,
            reply: result.reply,
            metrics: result.metrics,
            suggestedPrompts: result.suggestedPrompts,
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        console.error('[AI] Error processing query:', err);
        res.status(500).json({ error: 'AI advisor encountered an error processing your request' });
    }
});
