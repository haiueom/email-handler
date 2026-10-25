import { handleEmail } from './email';

export default {
	email: handleEmail,
} satisfies ExportedHandler<Env>;
