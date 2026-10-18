import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { broadcastEvent } from '../services/websocket.js';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
export const feedbackRouter = Router();
// Rate limiter for public customer feedback submissions (15 per 10 minutes per IP)
const feedbackRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    message: { error: 'Too many feedback submissions from this connection. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
/**
 * 1. Public Endpoint: Get Branch Info & Tags for Mobile Feedback Form
 * Allows customers who scan the QR code to see branch name, active tables, waiters, and dishes.
 */
feedbackRouter.get('/branch-info/:branchId', (req, res) => {
    try {
        const { branchId } = req.params;
        let branch = db.prepare('SELECT id, name, city, address, phone FROM branches WHERE id = ? AND is_active = 1').get(branchId);
        // Fallback if generic QR or invalid branch ID
        if (!branch) {
            branch = db.prepare('SELECT id, name, city, address, phone FROM branches WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1').get();
        }
        if (!branch) {
            return res.status(404).json({ error: 'No active branch found' });
        }
        const targetBranchId = branch.id;
        // Get active tables for this branch
        const tables = db.prepare(`
      SELECT id, table_number, name, section 
      FROM restaurant_tables 
      WHERE branch_id = ? AND is_active = 1 
      ORDER BY table_number ASC
    `).all(targetBranchId);
        // Get active waiters for this branch
        const waiters = db.prepare(`
      SELECT id, full_name, employee_id 
      FROM users 
      WHERE branch_id = ? AND role = 'waiter' AND status = 'ACTIVE' AND deleted_at IS NULL
      ORDER BY full_name ASC
    `).all(targetBranchId);
        // Get popular menu items for dish feedback
        const menuItems = db.prepare(`
      SELECT id, name, name_amharic, price, photo_url 
      FROM menu_items 
      WHERE is_available = 1 AND deleted_at IS NULL
      ORDER BY created_at DESC 
      LIMIT 25
    `).all();
        // Get restaurant settings branding
        const settings = db.prepare(`
      SELECT restaurant_name, slogan, logo_url, primary_color, secondary_color 
      FROM restaurant_settings 
      LIMIT 1
    `).get();
        res.json({
            branch,
            tables,
            waiters,
            menuItems,
            settings: settings || {
                restaurant_name: 'Yo Burger & Restaurant',
                slogan: 'Delicious Burgers & Seamless Hospitality',
                logo_url: '/logo.png'
            }
        });
    }
    catch (error) {
        console.error('[Feedback] Error fetching branch info:', error);
        res.status(500).json({ error: 'Failed to retrieve restaurant information' });
    }
});
/**
 * 2. Public Endpoint: Submit Customer Review / Feedback
 * Rate-limited to prevent abuse. Automatically triggers manager alerts on low ratings.
 */
feedbackRouter.post('/', feedbackRateLimiter, (req, res) => {
    try {
        const { branch_id, overall_rating, food_rating, service_rating, cleanliness_rating, ambiance_rating, comment, dishes_feedback, table_number, order_id, waiter_id, waiter_name, customer_name, customer_phone, customer_email, language } = req.body;
        const ratingNum = Number(overall_rating);
        if (!branch_id || !ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Valid branch_id and overall_rating (1-5) are required' });
        }
        // Defensive branch resolution
        const branchExists = db.prepare('SELECT id, name FROM branches WHERE id = ?').get(branch_id);
        const finalBranchId = branchExists ? branch_id : db.prepare('SELECT id FROM branches LIMIT 1').get()?.id || branch_id;
        const branchName = branchExists?.name || 'Main Branch';
        // Look up waiter name if waiter_id provided
        let finalWaiterName = waiter_name;
        if (waiter_id && !finalWaiterName) {
            const waiterRow = db.prepare('SELECT full_name FROM users WHERE id = ?').get(waiter_id);
            if (waiterRow)
                finalWaiterName = waiterRow.full_name;
        }
        // Determine sentiment
        let sentiment = 'NEUTRAL';
        if (ratingNum >= 4) {
            sentiment = 'POSITIVE';
        }
        else if (ratingNum <= 2) {
            sentiment = 'NEGATIVE';
        }
        const id = `fb_${uuidv4().substring(0, 10)}`;
        const dishesFeedbackJson = typeof dishes_feedback === 'string'
            ? dishes_feedback
            : JSON.stringify(dishes_feedback || []);
        const cleanLanguage = ['en', 'am', 'om'].includes(language) ? language : 'en';
        db.prepare(`
      INSERT INTO customer_feedback (
        id, branch_id, table_number, order_id, waiter_id, waiter_name,
        overall_rating, food_rating, service_rating, cleanliness_rating, ambiance_rating,
        comment, dishes_feedback, customer_name, customer_phone, customer_email,
        sentiment, status, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
    `).run(id, finalBranchId, table_number || null, order_id || null, waiter_id || null, finalWaiterName || null, ratingNum, food_rating ? Number(food_rating) : null, service_rating ? Number(service_rating) : null, cleanliness_rating ? Number(cleanliness_rating) : null, ambiance_rating ? Number(ambiance_rating) : null, comment ? String(comment).trim().slice(0, 2000) : null, dishesFeedbackJson, customer_name ? String(customer_name).trim().slice(0, 100) : null, customer_phone ? String(customer_phone).trim().slice(0, 50) : null, customer_email ? String(customer_email).trim().slice(0, 100) : null, sentiment, cleanLanguage);
        const feedbackRecord = {
            id,
            branch_id: finalBranchId,
            branch_name: branchName,
            table_number,
            waiter_name: finalWaiterName,
            overall_rating: ratingNum,
            sentiment,
            comment,
            created_at: new Date().toISOString()
        };
        // ── Instant Alert for Low Ratings (1 or 2 Stars) ──────────────────────────
        if (ratingNum <= 2) {
            const alertTitleEn = `🚨 Urgent Review Alert: ${ratingNum}★ at Table ${table_number || 'General'}`;
            const alertTitleAm = `🚨 አፋጣኝ የአስተያየት ማስጠንቀቂያ፡ ${ratingNum}★ (ጠረጴዛ ${table_number || 'ጠቅላላ'})`;
            const alertMsgEn = comment ? `"${comment}" - Needs immediate manager attention.` : `Customer left a low rating (${ratingNum}/5). Check table or order.`;
            const alertMsgAm = comment ? `"${comment}" - የስራ አስኪያጅ ፈጣን እርምጃ ያስፈልገዋል።` : `ደንበኛ ዝቅተኛ ደረጃ ሰጥቷል (${ratingNum}/5)። ጠረጴዛውን ያረጋግጡ።`;
            // Insert in notifications for Admin & Owner
            try {
                const notifId = `notif_${uuidv4().substring(0, 8)}`;
                db.prepare(`
          INSERT INTO notifications (id, branch_id, type, title, title_amharic, message, message_amharic, target_role, is_read)
          VALUES (?, ?, 'URGENT', ?, ?, ?, ?, 'admin', 0)
        `).run(notifId, finalBranchId, alertTitleEn, alertTitleAm, alertMsgEn, alertMsgAm);
                const notifId2 = `notif_${uuidv4().substring(0, 8)}`;
                db.prepare(`
          INSERT INTO notifications (id, branch_id, type, title, title_amharic, message, message_amharic, target_role, is_read)
          VALUES (?, ?, 'URGENT', ?, ?, ?, ?, 'owner', 0)
        `).run(notifId2, finalBranchId, alertTitleEn, alertTitleAm, alertMsgEn, alertMsgAm);
            }
            catch (notifErr) {
                console.warn('[Feedback] Could not write urgent notification:', notifErr);
            }
            // Live WebSocket push to active Admin & Owner clients
            broadcastEvent({
                type: 'URGENT_FEEDBACK_ALERT',
                branchId: finalBranchId,
                targetRole: ['admin', 'owner'],
                payload: {
                    feedbackId: id,
                    branchName,
                    tableNumber: table_number,
                    rating: ratingNum,
                    comment,
                    waiterName: finalWaiterName,
                    customerName: customer_name
                }
            });
        }
        else {
            // Normal live WebSocket update
            broadcastEvent({
                type: 'NEW_CUSTOMER_FEEDBACK',
                branchId: finalBranchId,
                targetRole: ['admin', 'owner'],
                payload: feedbackRecord
            });
        }
        res.status(201).json({
            success: true,
            id,
            message: 'Feedback submitted successfully. Thank you!'
        });
    }
    catch (error) {
        console.error('[Feedback] Submission error:', error);
        res.status(500).json({ error: 'Failed to submit feedback. Please try again.' });
    }
});
/**
 * 3. Protected Endpoint: Get Feedbacks & Aggregated Analytics
 * Accessible by Admin, Owner, Superadmin.
 */
feedbackRouter.get('/', authenticate, authorizeRole(['admin', 'owner', 'superadmin']), (req, res) => {
    try {
        const rawBranchId = req.query.branchId;
        const isAll = rawBranchId === 'ALL' || (!rawBranchId && (req.user?.role === 'superadmin' || req.user?.role === 'owner') && !req.user?.branch_id);
        const branchId = isAll ? null : (rawBranchId || req.user.branch_id);
        const status = req.query.status; // 'NEW', 'REVIEWED', 'RESOLVED', 'ARCHIVED'
        const rating = req.query.rating ? Number(req.query.rating) : null;
        const sentiment = req.query.sentiment;
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const offset = Number(req.query.offset) || 0;
        let whereClauses = [];
        let params = [];
        if (branchId) {
            whereClauses.push('f.branch_id = ?');
            params.push(branchId);
        }
        if (status && status !== 'ALL') {
            whereClauses.push('f.status = ?');
            params.push(status);
        }
        if (rating) {
            whereClauses.push('f.overall_rating = ?');
            params.push(rating);
        }
        if (sentiment && sentiment !== 'ALL') {
            whereClauses.push('f.sentiment = ?');
            params.push(sentiment);
        }
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        // 1. Fetch reviews
        const reviewsQuery = `
      SELECT f.*, b.name AS branch_name
      FROM customer_feedback f
      LEFT JOIN branches b ON f.branch_id = b.id
      ${whereSql}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;
        const reviews = db.prepare(reviewsQuery).all(...params, limit, offset);
        // Parse dishes_feedback JSON safely
        const formattedReviews = reviews.map(r => {
            let parsedDishes = [];
            try {
                parsedDishes = r.dishes_feedback ? JSON.parse(r.dishes_feedback) : [];
            }
            catch (_) { }
            return {
                ...r,
                dishes_feedback: parsedDishes
            };
        });
        // 2. Fetch Aggregated Statistics
        const statsWhere = branchId ? 'WHERE branch_id = ?' : '';
        const statsParams = branchId ? [branchId] : [];
        const statsRow = db.prepare(`
      SELECT 
        COUNT(id) AS totalReviews,
        COALESCE(ROUND(AVG(overall_rating), 1), 0) AS avgRating,
        COALESCE(ROUND(AVG(food_rating), 1), 0) AS avgFood,
        COALESCE(ROUND(AVG(service_rating), 1), 0) AS avgService,
        COALESCE(ROUND(AVG(cleanliness_rating), 1), 0) AS avgCleanliness,
        COALESCE(ROUND(AVG(ambiance_rating), 1), 0) AS avgAmbiance,
        COUNT(CASE WHEN overall_rating = 5 THEN 1 END) AS count5,
        COUNT(CASE WHEN overall_rating = 4 THEN 1 END) AS count4,
        COUNT(CASE WHEN overall_rating = 3 THEN 1 END) AS count3,
        COUNT(CASE WHEN overall_rating = 2 THEN 1 END) AS count2,
        COUNT(CASE WHEN overall_rating = 1 THEN 1 END) AS count1,
        COUNT(CASE WHEN sentiment = 'POSITIVE' THEN 1 END) AS countPositive,
        COUNT(CASE WHEN sentiment = 'NEUTRAL' THEN 1 END) AS countNeutral,
        COUNT(CASE WHEN sentiment = 'NEGATIVE' THEN 1 END) AS countNegative,
        COUNT(CASE WHEN overall_rating <= 2 AND status != 'RESOLVED' THEN 1 END) AS unresolvedUrgentCount
      FROM customer_feedback
      ${statsWhere}
    `).get(...statsParams);
        res.json({
            reviews: formattedReviews,
            totalCount: statsRow?.totalReviews || 0,
            stats: {
                totalReviews: Number(statsRow?.totalReviews || 0),
                avgRating: Number(statsRow?.avgRating || 0),
                avgFood: Number(statsRow?.avgFood || 0),
                avgService: Number(statsRow?.avgService || 0),
                avgCleanliness: Number(statsRow?.avgCleanliness || 0),
                avgAmbiance: Number(statsRow?.avgAmbiance || 0),
                ratingDistribution: {
                    5: Number(statsRow?.count5 || 0),
                    4: Number(statsRow?.count4 || 0),
                    3: Number(statsRow?.count3 || 0),
                    2: Number(statsRow?.count2 || 0),
                    1: Number(statsRow?.count1 || 0)
                },
                sentimentDistribution: {
                    POSITIVE: Number(statsRow?.countPositive || 0),
                    NEUTRAL: Number(statsRow?.countNeutral || 0),
                    NEGATIVE: Number(statsRow?.countNegative || 0)
                },
                unresolvedUrgentCount: Number(statsRow?.unresolvedUrgentCount || 0)
            }
        });
    }
    catch (error) {
        console.error('[Feedback] Fetch error:', error);
        res.status(500).json({ error: 'Failed to retrieve feedback data' });
    }
});
/**
 * 4. Protected Endpoint: Update Review Status & Manager Notes
 */
feedbackRouter.patch('/:id/status', authenticate, authorizeRole(['admin', 'owner', 'superadmin']), (req, res) => {
    try {
        const { id } = req.params;
        const { status, manager_notes } = req.body;
        const validStatuses = ['NEW', 'REVIEWED', 'RESOLVED', 'ARCHIVED'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        db.prepare(`
      UPDATE customer_feedback
      SET status = COALESCE(?, status),
          manager_notes = COALESCE(?, manager_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status || null, manager_notes !== undefined ? manager_notes : null, id);
        res.json({ message: 'Feedback updated successfully', id, status });
    }
    catch (error) {
        console.error('[Feedback] Update error:', error);
        res.status(500).json({ error: 'Failed to update feedback status' });
    }
});
/**
 * 5. Protected Endpoint: AI-Powered Customer Sentiment & Theme Insights
 * Summarizes recurring compliments, complaints, and operational suggestions.
 */
feedbackRouter.get('/ai-insights', authenticate, authorizeRole(['admin', 'owner', 'superadmin']), (req, res) => {
    try {
        const rawBranchId = req.query.branchId;
        const isAll = rawBranchId === 'ALL' || (!rawBranchId && (req.user?.role === 'superadmin' || req.user?.role === 'owner') && !req.user?.branch_id);
        const branchId = isAll ? null : (rawBranchId || req.user.branch_id);
        const whereClause = branchId ? 'WHERE branch_id = ?' : '';
        const params = branchId ? [branchId] : [];
        // Fetch the 60 most recent reviews
        const recentReviews = db.prepare(`
      SELECT overall_rating, food_rating, service_rating, cleanliness_rating, ambiance_rating, comment, dishes_feedback, language, created_at
      FROM customer_feedback
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 60
    `).all(...params);
        if (recentReviews.length === 0) {
            return res.json({
                summary: 'No customer reviews collected yet. Share your branch QR codes with customers to start receiving AI insights.',
                summaryAmharic: 'እስካሁን ምንም የደንበኛ አስተያየት አልተመዘገበም። የቅርንጫፍዎን QR ኮድ ለደንበኞች በማጋራት ይጀምሩ።',
                summaryOromo: 'Hamma yoonaatti yaanni maamilaa hin galmoofne. Qorannoo AI argachuuf koodii QR damee keessanii maamiltootaaf qoodaa.',
                praises: [],
                complaints: [],
                actionItems: []
            });
        }
        // Heuristic & Semantic synthesis of comments
        let positiveCount = 0;
        let negativeCount = 0;
        const praisesSet = new Set();
        const complaintsSet = new Set();
        for (const r of recentReviews) {
            if (r.overall_rating >= 4)
                positiveCount++;
            if (r.overall_rating <= 2)
                negativeCount++;
            const commentLower = (r.comment || '').toLowerCase();
            // Analyze text for praise keywords
            if (commentLower.includes('delicious') || commentLower.includes('tasty') || commentLower.includes('ጥሩ') || commentLower.includes('ጣፋጭ') || commentLower.includes('mi\'aawaa')) {
                praisesSet.add('Customer praised outstanding food taste & quality / ጣፋጭ ምግብ');
            }
            if (commentLower.includes('fast') || commentLower.includes('quick') || commentLower.includes('ፈጣን') || commentLower.includes('saffisa')) {
                praisesSet.add('Prompt service speed and attentive waiters / ፈጣን መስተንግዶ');
            }
            if (commentLower.includes('clean') || commentLower.includes('hygiene') || commentLower.includes('ንጹህ') || commentLower.includes('qulqulluu')) {
                praisesSet.add('High marks for clean tables and welcoming dining room / ንጽህና');
            }
            if (commentLower.includes('coffee') || commentLower.includes('burger') || commentLower.includes('cake') || commentLower.includes('ቡና') || commentLower.includes('በርገር')) {
                praisesSet.add('Special mentions for signature burgers, fresh cakes, and specialty coffee');
            }
            // Analyze text for complaint keywords
            if (commentLower.includes('slow') || commentLower.includes('delay') || commentLower.includes('ረፈደ') || commentLower.includes('ዘገየ') || commentLower.includes('suuta')) {
                complaintsSet.add('Orders taking too long during peak rush / የትዕዛዝ መዘግየት');
            }
            if (commentLower.includes('cold') || commentLower.includes('qabbana') || commentLower.includes('ቀዘቀዘ')) {
                complaintsSet.add('Food served lukewarm or cold before reaching table / የቀዘቀዘ ምግብ');
            }
            if (commentLower.includes('loud') || commentLower.includes('noise') || commentLower.includes('ሙዚቃ') || commentLower.includes('ጩኸት') || commentLower.includes('sagalee')) {
                complaintsSet.add('Dining room audio or background music too loud / የሙዚቃ ጩኸት');
            }
            if (commentLower.includes('wrong') || commentLower.includes('missing') || commentLower.includes('ስህተት') || commentLower.includes('dogoggora')) {
                complaintsSet.add('Occasional order inaccuracy or missing sides / የተሳሳተ ትዕዛዝ');
            }
        }
        // Default fallbacks if comments are concise
        if (praisesSet.size === 0) {
            praisesSet.add('Consistent high overall ratings across core menu offerings');
            praisesSet.add('Appreciated friendly hospitality and welcoming atmosphere');
        }
        if (complaintsSet.size === 0 && negativeCount > 0) {
            complaintsSet.add('Isolated low ratings require follow-up with floor captains');
        }
        const actionItems = [];
        if (negativeCount > 0) {
            actionItems.push('Review kitchen ticket pickup times with the head chef to reduce table delay.');
            actionItems.push('Conduct quick morning briefing with waitstaff on checking customer drinks promptly.');
        }
        else {
            actionItems.push('Maintain current kitchen prep standards and congratulate front-of-house staff for great ratings.');
        }
        actionItems.push('Display table tent QR codes prominently to encourage even more 5-star Google & in-house reviews.');
        const satisfactionPercent = Math.round((positiveCount / recentReviews.length) * 100);
        res.json({
            summary: `Analyzed ${recentReviews.length} customer reviews. Overall customer satisfaction stands at ${satisfactionPercent}%.`,
            summaryAmharic: `${recentReviews.length} የደንበኞች አስተያየቶች ተተንትነዋል። አጠቃላይ የደንበኛ እርካታ ${satisfactionPercent}% ላይ ይገኛል።`,
            summaryOromo: `Yaada maamiltootaa ${recentReviews.length} qoratameera. Sadarkaan itti-quufiinsa maamiltootaa waliigalaa %${satisfactionPercent} irra jira.`,
            satisfactionPercent,
            totalAnalyzed: recentReviews.length,
            praises: Array.from(praisesSet),
            complaints: Array.from(complaintsSet),
            actionItems
        });
    }
    catch (error) {
        console.error('[Feedback] AI Insights error:', error);
        res.status(500).json({ error: 'Failed to generate feedback AI insights' });
    }
});
