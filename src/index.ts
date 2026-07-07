import { handleEmail } from './emailHandler';
import routeHandler from './routeHandler';

export default {
	fetch: routeHandler.fetch,
	email: handleEmail,
};
