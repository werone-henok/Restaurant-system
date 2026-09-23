import { ZodError } from 'zod';
export function validate(schema, options = {}) {
    const source = options.source ?? 'body';
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req[source]);
            // Replace raw data with validated & coerced data
            req[source] = parsed;
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                const issues = err.issues.map(i => ({
                    field: i.path.join('.'),
                    message: i.message,
                    code: i.code
                }));
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'ERR_VALIDATION',
                        details: issues
                    }
                });
            }
            next(err);
        }
    };
}
