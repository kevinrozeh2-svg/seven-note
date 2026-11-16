export const GOOGLE_APPS_SCRIPT_TEMPLATE = `const SECRET_TOKEN = 'CAMBIA_ESTE_TOKEN_SECRETO';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'Token secreto inválido' });
    }

    const action = body.action || 'ping';
    if (action === 'ping') {
      return jsonResponse({ ok: true, message: 'Conexión activa con Google Calendar' });
    }

    const calId = body.googleCalendarId;
    const cal = calId ? CalendarApp.getCalendarById(calId) : CalendarApp.getDefaultCalendar();
    if (!cal) {
      return jsonResponse({ ok: false, error: 'Calendario no encontrado: ' + calId });
    }

    if (action === 'create') {
      const options = {
        description: body.description || '',
        location: body.location || ''
      };
      const ev = body.isAllDay
        ? createAllDay(cal, body.title, body.startIso, body.endIso, options)
        : cal.createEvent(body.title, new Date(body.startIso), new Date(body.endIso), options);
      return jsonResponse({ ok: true, googleEventId: ev.getId() });
    }

    if (action === 'update') {
      const ev = body.googleEventId ? cal.getEventById(body.googleEventId) : null;
      if (!ev) {
        return jsonResponse({ ok: false, error: 'Evento no encontrado en Google Calendar' });
      }
      ev.setTitle(body.title || ev.getTitle());
      ev.setDescription(body.description || '');
      ev.setLocation(body.location || '');
      if (body.isAllDay) {
        ev.setAllDayDates(new Date(body.startIso), new Date(body.endIso));
      } else {
        ev.setTime(new Date(body.startIso), new Date(body.endIso));
      }
      return jsonResponse({ ok: true, googleEventId: ev.getId() });
    }

    if (action === 'delete') {
      const ev = body.googleEventId ? cal.getEventById(body.googleEventId) : null;
      if (ev) ev.deleteEvent();
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Acción no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function createAllDay(cal, title, startIso, endIso, options) {
  const start = new Date(startIso.slice(0, 10) + 'T00:00:00');
  const end = endIso ? new Date(endIso.slice(0, 10) + 'T00:00:00') : new Date(start.getTime() + 86400000);
  if (end.getTime() <= start.getTime() + 86400000) {
    return cal.createAllDayEvent(title, start, options);
  }
  return cal.createAllDayEvent(title, start, end, options);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`
