export function sendSuccess(res, payload) {
    const status = payload.statusCode ?? 200;
    res.status(status).json({
        success: true,
        ...(payload.message ? { message: payload.message } : {}),
        data: payload.data,
        ...(payload.meta ? { meta: payload.meta } : {})
    });
}
export function sendError(res, payload) {
    const status = payload.statusCode ?? 500;
    res.status(status).json({
        success: false,
        error: {
            message: payload.message,
            code: payload.code ?? 'ERR_UNKNOWN'
        },
        ...(payload.meta ? { meta: payload.meta } : {})
    });
}
/**
 * Shorthand for 201 Created with data + optional message.
 */
export function sendCreated(res, data, message) {
    sendSuccess(res, { data, statusCode: 201, message });
}
