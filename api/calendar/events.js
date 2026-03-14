const { ObjectId } = require('mongodb');
const { parseBody, send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { getDb, ensureSchema } = require('../_lib/db');

function nowIso() {
  return new Date().toISOString();
}

function toIso(value) {
  const d = new Date(String(value || '').trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toDateKey(isoValue) {
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeEvent(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    category: doc.category || 'custom',
    notes: doc.notes || '',
    allDay: !!doc.allDay,
    dateKey: doc.dateKey,
    startTime: doc.startTime,
    endTime: doc.endTime || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    source: doc.source || 'user'
  };
}

module.exports = async (req, res) => {
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  await ensureSchema();
  const db = await getDb();
  if (!db) return send(res, 500, { error: 'MongoDB is not configured' });

  const collection = db.collection('calendar_events');
  const userId = authUser.userId;

  if (req.method === 'GET') {
    const month = String(req.query.month || '').trim(); // YYYY-MM
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));

    const filter = { userId };
    if (/^\d{4}-\d{2}$/.test(month)) {
      filter.dateKey = { $regex: `^${month}-` };
    }

    const events = await collection.find(filter).sort({ startTime: 1, _id: 1 }).limit(limit).toArray();
    return send(res, 200, {
      success: true,
      userId,
      month: month || null,
      count: events.length,
      events: events.map(normalizeEvent)
    });
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const title = String(body.title || '').trim();
    const startIso = toIso(body.startTime);
    const endIso = body.endTime ? toIso(body.endTime) : null;

    if (!title) return send(res, 400, { error: 'title is required' });
    if (!startIso) return send(res, 400, { error: 'startTime is required and must be a valid date' });
    if (body.endTime && !endIso) return send(res, 400, { error: 'endTime must be a valid date' });

    const doc = {
      userId,
      title,
      category: String(body.category || 'custom').trim() || 'custom',
      notes: String(body.notes || '').trim(),
      allDay: !!body.allDay,
      startTime: startIso,
      endTime: endIso,
      dateKey: toDateKey(startIso),
      source: String(body.source || 'user').trim() || 'user',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const result = await collection.insertOne(doc);
    const created = await collection.findOne({ _id: result.insertedId });

    return send(res, 200, {
      success: true,
      message: 'Calendar event created',
      event: normalizeEvent(created)
    });
  }

  if (req.method === 'PUT') {
    const body = parseBody(req);
    const eventId = String(body.eventId || '').trim();
    if (!eventId || !ObjectId.isValid(eventId)) {
      return send(res, 400, { error: 'valid eventId is required' });
    }

    const update = {};
    if (body.title !== undefined) update.title = String(body.title || '').trim();
    if (body.category !== undefined) update.category = String(body.category || '').trim() || 'custom';
    if (body.notes !== undefined) update.notes = String(body.notes || '').trim();
    if (body.allDay !== undefined) update.allDay = !!body.allDay;

    if (body.startTime !== undefined) {
      const startIso = toIso(body.startTime);
      if (!startIso) return send(res, 400, { error: 'startTime must be a valid date' });
      update.startTime = startIso;
      update.dateKey = toDateKey(startIso);
    }

    if (body.endTime !== undefined) {
      if (body.endTime === null || body.endTime === '') {
        update.endTime = null;
      } else {
        const endIso = toIso(body.endTime);
        if (!endIso) return send(res, 400, { error: 'endTime must be a valid date' });
        update.endTime = endIso;
      }
    }

    if (!Object.keys(update).length) {
      return send(res, 400, { error: 'no update fields provided' });
    }

    if ('title' in update && !update.title) {
      return send(res, 400, { error: 'title cannot be empty' });
    }

    update.updatedAt = nowIso();

    const targetId = new ObjectId(eventId);

    const result = await collection.findOneAndUpdate(
      { _id: targetId, userId },
      { $set: update },
      { returnDocument: 'after' }
    );

    const updatedDoc = result?.value || (await collection.findOne({ _id: targetId, userId }));
    if (!updatedDoc) return send(res, 404, { error: 'event not found' });

    return send(res, 200, {
      success: true,
      message: 'Calendar event updated',
      event: normalizeEvent(updatedDoc)
    });
  }

  if (req.method === 'DELETE') {
    const body = parseBody(req);
    const eventId = String(body.eventId || req.query.eventId || '').trim();
    if (!eventId || !ObjectId.isValid(eventId)) {
      return send(res, 400, { error: 'valid eventId is required' });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(eventId), userId });
    if (!result.deletedCount) return send(res, 404, { error: 'event not found' });

    return send(res, 200, { success: true, message: 'Calendar event deleted', eventId });
  }

  return send(res, 405, { error: 'Method not allowed' });
};
