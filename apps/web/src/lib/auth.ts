import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { loadEnv } from "@exactpoint/config";
import * as schema from "@exactpoint/db";
import { getDb } from "@exactpoint/db";

const env = loadEnv();

const ac = createAccessControl(defaultStatements);
/** The owner has full administrative capability; technicians have none. */
const ownerRole = ac.newRole(adminAc.statements);
const technicianRole = ac.newRole({});

/**
 * Internal-only authentication (owner + technicians). Public signup is
 * disabled — customers book without accounts; technicians join by invitation.
 */
export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    // Local E2E runs sign in rapidly from one IP; production keeps the
    // brute-force limiter on (env flag is never set there).
    enabled: process.env.AUTH_RATE_LIMIT_DISABLED === "1" ? false : true,
  },
  plugins: [
    admin({
      ac,
      roles: { owner: ownerRole, technician: technicianRole },
      adminRoles: ["owner"],
      defaultRole: "technician",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
