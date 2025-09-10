// src/config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User.js';

console.log(process.env.GOOGLE_CLIENT_ID);

// Helper: create or update a user from an OAuth profile
const upsertUserFromProfile = async ({ provider, id, displayName, emails, photos }) => {
  const email = emails?.[0]?.value?.toLowerCase();
  const photo = photos?.[0]?.value;

  // Try to find by provider+id first
  let user = await User.findOne({ oauthProvider: provider, oauthId: id });

  // If not found, fall back to email (lets users connect with same email later)
  if (!user && email) {
    user = await User.findOne({ email });
  }

  if (!user) {
    user = await User.create({
      oauthProvider: provider,
      oauthId: id,
      name: displayName || 'New User',
      email,
      photo,
      role: 'user',
      siteAuthorized: false,
      banned: false
    });
  } else {
    // Minimal profile refresh
    if (!user.name && displayName) user.name = displayName;
    if (!user.photo && photo) user.photo = photo;
    if (!user.email && email) user.email = email;
    await user.save();
  }

  return user;
};

// -- Google OAuth 2.0 --------------------------------------------------------
const hasGoogle =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL;

if (hasGoogle) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await upsertUserFromProfile({
            provider: 'google',
            id: profile.id,
            displayName: profile.displayName,
            emails: profile.emails,
            photos: profile.photos
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
} else {
  console.warn(
    '[passport] Skipping GoogleStrategy: set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL in your .env'
  );
}

// -- Facebook OAuth 2.0 ------------------------------------------------------
const hasFacebook =
  process.env.FACEBOOK_CLIENT_ID &&
  process.env.FACEBOOK_CLIENT_SECRET &&
  process.env.FACEBOOK_CALLBACK_URL;

if (hasFacebook) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'emails', 'photos'] // request email+photo
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await upsertUserFromProfile({
            provider: 'facebook',
            id: profile.id,
            displayName: profile.displayName,
            emails: profile.emails,
            photos: profile.photos
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
} else {
  console.warn(
    '[passport] Skipping FacebookStrategy: set FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET / FACEBOOK_CALLBACK_URL in your .env'
  );
}

// We’re using JWTs (session: false in routes), so no serialize/deserialize needed.
// Exporting passport is optional since we import this file for side effects.
export default passport;