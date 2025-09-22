import { handleEmail } from './emailHandler';
import routeHandler from './routeHandler';

/**
 * Main worker object that routes events to the appropriate handlers.
 */
export default {
    /**
     * Handles web requests for the API and dashboard.
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Pass the request to the Hono app's fetch method
        return routeHandler.fetch(request, env, ctx);
    },

    /**
     * Handles incoming emails.
     */
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        // Pass the email message to the email handler
        await handleEmail(message, env);
    },
};

