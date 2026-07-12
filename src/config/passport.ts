import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';
import { prisma } from './database';
import { env } from './env';

// ─────────────────────────────────────────────────────────────────────────────
// src/config/passport.ts
// Google OAuth strategy — staff whitelist model (§C4).
//
// RULES (non-negotiable):
//   • No self-signup — admin must pre-create staff records via POST /staff/invite
//   • Google login is ONLY allowed when staff.is_active = true AND deleted_at IS NULL
//   • oauth_id is set on the first successful Google login (not at invite time)
//   • The email address is the matching key — profile.id links to the row after match
//
// Flow:
//   1. Google returns the staff member's email from profile.emails[0]
//   2. We look up staff_users WHERE email = ? AND is_active = true AND deleted_at IS NULL
//   3. No match → authentication fails with 'Account not whitelisted'
//   4. Match, first login (oauthId is null) → set oauthProvider + oauthId on the row
//   5. Match, subsequent login (oauthId already set) → just return the staff row
// ─────────────────────────────────────────────────────────────────────────────

async function verifyGoogleProfile(
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
): Promise<void> {
  try {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      return done(null, false, {
        message: 'Google account has no verified email address',
      });
    }

    // Only active, non-deleted staff may log in (§AUTH ISOLATION: is_active
    // re-checked on every request — here we also enforce it at OAuth time).
    const staff = await prisma.staffUser.findFirst({
      where: {
        email, 
        isActive: true,
        deletedAt: null,
      },
      include: {
        branch: {
          select: { id: true, name: true, isActive: true },
        },
        restaurant: {
          select: { id: true, name: true },
        },
      },
    });

    if (!staff) {
      return done(null, false, {
        message: 'Account not whitelisted. Contact your administrator.',
      });
    }

    // First-time Google login — bind the Google profile ID to the staff row.
    // We only do this when oauthId is null so that an admin cannot hijack
    // another staff member's slot by logging in with a different Google account.
    if (!staff.oauthId) {
      const updated = await prisma.staffUser.update({
        where: { id: staff.id },
        data: {
          oauthProvider: 'google',
          oauthId: profile.id,
        },
        include: {
          branch: { select: { id: true, name: true, isActive: true } },
          restaurant: { select: { id: true, name: true } },
        },
      });
      // The auth controller receives this as `req.user` and immediately maps
      // it to JWT tokens — it is NOT the slim JWT payload shape that req.user
      // carries after authenticate() middleware. The cast is intentional.
      return done(null, updated as unknown as Express.User);
    }

    // Guard: if somehow a different Google ID is presented for the same email,
    // deny. This prevents account takeover if a Google account is compromised
    // or if the email is reused.
    if (staff.oauthId !== profile.id) {
      return done(null, false, {
        message: 'Google account does not match the registered account for this email.',
      });
    }

    return done(null, staff as unknown as Express.User);
  } catch (err) {
    return done(err as Error);
  }
}

export function configurePassport(): void {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        // Request email + profile scopes — the minimum needed
        scope: ['profile', 'email'],
      },
      verifyGoogleProfile,
    ),
  );

  // ── Session serialization ────────────────────────────────────────────────
  // We do NOT use Passport sessions (stateless JWT architecture).
  // These stubs are required by passport internals but are never actually
  // invoked in a sessionless setup with authenticate({ session: false }).
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));
}

// Register the Google strategy as soon as this module is imported.
configurePassport();
