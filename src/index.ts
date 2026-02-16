import { handleEmail } from './emailHandler';
import routeHandler from './routeHandler';

/**
 * Main worker object that routes events to the appropriate handlers.
 * This pattern directly exports the handlers from their respective modules,
 * which is a cleaner approach when using a framework like Hono.
 */
export default {
	/**
	 * Handles web requests by exporting the Hono app's fetch handler directly.
	 */
	fetch: routeHandler.fetch,

	/**
	 * Handles incoming emails by exporting the email handler directly.
	 */
	email: handleEmail,
};
