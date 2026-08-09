import 'dotenv/config';
import { pool } from '../db/pool.js';
import {
  processDayCloseReminders,
  processUpcomingBookingNotifications,
} from '../services/notificationEventService.js';

const now = new Date();

try {
  const upcoming = await processUpcomingBookingNotifications(now);
  const dayClose = await processDayCloseReminders(now);
  console.info(`Push reminders upcoming=${upcoming.events} day_close=${dayClose.events} failed=${upcoming.failed + dayClose.failed}`);
} finally {
  await pool.end();
}
