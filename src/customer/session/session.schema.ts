import { z } from 'zod';

// No body needed for GET /customer/session
// No body needed for POST /customer/session/leave or /complete
// Keeping schema file for consistency and future extension
export const customerSessionSchema = z.object({});
