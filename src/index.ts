import { handleEmail } from './emailHandler';

export default {
	email: handleEmail,
} satisfies ExportedHandler<Env>;
