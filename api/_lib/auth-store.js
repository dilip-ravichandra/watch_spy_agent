const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const SESSION_TTL_DAYS = 30;
const DEFAULT_RESET_TTL_MINUTES = 15;

const memory = {
  users: [],
  sessions: [],
  passwordResets: []
};

let cachedClient = null;
let cachedDb = null;
let indexesReady = false;

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUserId(userId) {
  return String(userId || '').trim();
}

function publicUser(user) {
  if (!user) return null;
  return {
    userId: user.userId,
    email: user.email,
    fullName: user.fullName || '',
    createdAt: user.createdAt
  };
}

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!cachedDb) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
    cachedDb = cachedClient.db(process.env.MONGODB_DB || 'watch_spy_agent');
  }

  if (!indexesReady) {
    await cachedDb.collection('users').createIndex({ emailLower: 1 }, { unique: true });
    await cachedDb.collection('users').createIndex({ userId: 1 }, { unique: true });
    await cachedDb.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await cachedDb.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await cachedDb.collection('password_resets').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await cachedDb.collection('password_resets').createIndex({ emailLower: 1, createdAt: -1 });
    await cachedDb.collection('password_resets').createIndex({ tokenHash: 1 });
    indexesReady = true;
  }

  return cachedDb;
}

function hashPassword(password, saltHex) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, saltHex, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
}

async function createUser({ userId, email, password, fullName }) {
  const cleanUserId = normalizeUserId(userId);
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(fullName || '').trim();

  const db = await getDb();
  const existing = await findUserByEmailOrId(cleanEmail, cleanUserId);
  if (existing) {
    const byEmail = normalizeEmail(existing.email) === cleanEmail;
    const conflictField = byEmail ? 'email' : 'userId';
    const error = new Error(`${conflictField} already exists`);
    error.code = 'DUPLICATE_USER';
    error.field = conflictField;
    throw error;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  const doc = {
    userId: cleanUserId,
    email: String(email || '').trim(),
    emailLower: cleanEmail,
    fullName: cleanName,
    passwordSalt: salt,
    passwordHash,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  if (db) {
    await db.collection('users').insertOne(doc);
  } else {
    memory.users.push(doc);
  }

  return publicUser(doc);
}

async function findUserByEmailOrId(emailLower, userId) {
  const db = await getDb();
  if (db) {
    return db.collection('users').findOne({ $or: [{ emailLower }, { userId }] });
  }

  return memory.users.find((u) => u.emailLower === emailLower || u.userId === userId) || null;
}

async function verifyUser(email, password) {
  const emailLower = normalizeEmail(email);
  const db = await getDb();
  const user = db
    ? await db.collection('users').findOne({ emailLower })
    : memory.users.find((u) => u.emailLower === emailLower) || null;

  if (!user) return null;

  const attemptedHash = await hashPassword(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, 'hex');
  const attempted = Buffer.from(attemptedHash, 'hex');
  if (expected.length !== attempted.length) return null;
  if (!crypto.timingSafeEqual(expected, attempted)) return null;

  return publicUser(user);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

async function createPasswordResetToken(email, ttlMinutes = DEFAULT_RESET_TTL_MINUTES) {
  const emailLower = normalizeEmail(email);
  const db = await getDb();
  const user = db
    ? await db.collection('users').findOne({ emailLower })
    : memory.users.find((u) => u.emailLower === emailLower) || null;

  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Number(ttlMinutes || DEFAULT_RESET_TTL_MINUTES) * 60 * 1000);

  const doc = {
    emailLower,
    userId: user.userId,
    tokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    usedAt: null
  };

  if (db) {
    await db.collection('password_resets').insertOne(doc);
  } else {
    memory.passwordResets.push(doc);
  }

  return {
    token: rawToken,
    email: user.email,
    userId: user.userId,
    expiresAt: doc.expiresAt
  };
}

async function consumePasswordResetToken(email, token) {
  const emailLower = normalizeEmail(email);
  const tokenHash = sha256(token);
  const now = Date.now();
  const nowIsoValue = new Date(now).toISOString();
  const db = await getDb();

  if (db) {
    const doc = await db.collection('password_resets').findOne(
      { emailLower, tokenHash, usedAt: null },
      { sort: { createdAt: -1 } }
    );
    if (!doc) return null;
    if (new Date(doc.expiresAt).getTime() <= now) return null;

    const updated = await db
      .collection('password_resets')
      .updateOne({ _id: doc._id, usedAt: null }, { $set: { usedAt: nowIsoValue } });
    if (!updated.modifiedCount) return null;

    return { userId: doc.userId, emailLower };
  }

  const matches = memory.passwordResets
    .filter((r) => r.emailLower === emailLower && r.tokenHash === tokenHash && !r.usedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const doc = matches[0] || null;
  if (!doc) return null;
  if (new Date(doc.expiresAt).getTime() <= now) return null;
  doc.usedAt = nowIsoValue;
  return { userId: doc.userId, emailLower };
}

async function updatePasswordByUserId(userId, newPassword) {
  const cleanUserId = normalizeUserId(userId);
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(newPassword, salt);
  const updatedAt = nowIso();
  const db = await getDb();

  if (db) {
    const result = await db.collection('users').updateOne(
      { userId: cleanUserId },
      {
        $set: {
          passwordSalt: salt,
          passwordHash,
          updatedAt
        }
      }
    );
    return (result.modifiedCount || 0) > 0;
  }

  const user = memory.users.find((u) => u.userId === cleanUserId);
  if (!user) return false;
  user.passwordSalt = salt;
  user.passwordHash = passwordHash;
  user.updatedAt = updatedAt;
  return true;
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = {
    token,
    userId: user.userId,
    email: user.email,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  const db = await getDb();
  if (db) {
    await db.collection('sessions').insertOne(session);
  } else {
    memory.sessions.push(session);
  }

  return {
    token,
    expiresAt: session.expiresAt
  };
}

async function getUserByToken(token) {
  if (!token) return null;

  const db = await getDb();
  if (db) {
    const session = await db.collection('sessions').findOne({ token });
    if (!session) return null;

    const expired = new Date(session.expiresAt).getTime() <= Date.now();
    if (expired) {
      await db.collection('sessions').deleteOne({ token });
      return null;
    }

    const user = await db.collection('users').findOne({ userId: session.userId });
    return publicUser(user);
  }

  const session = memory.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    memory.sessions = memory.sessions.filter((s) => s.token !== token);
    return null;
  }
  const user = memory.users.find((u) => u.userId === session.userId);
  return publicUser(user);
}

async function deleteSessionByToken(token) {
  if (!token) return;

  const db = await getDb();
  if (db) {
    await db.collection('sessions').deleteOne({ token });
    return;
  }

  memory.sessions = memory.sessions.filter((s) => s.token !== token);
}

function authStorageMode() {
  return process.env.MONGODB_URI ? 'mongodb' : 'memory';
}

module.exports = {
  createUser,
  verifyUser,
  createSession,
  getUserByToken,
  deleteSessionByToken,
  createPasswordResetToken,
  consumePasswordResetToken,
  updatePasswordByUserId,
  authStorageMode,
  normalizeEmail,
  normalizeUserId
};
