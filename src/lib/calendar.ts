import { google } from "googleapis";
import { prisma } from "./prisma";

export async function createCalendarEvent(
  userId: string,
  title: string,
  description: string | null,
  startTime: Date,
  endTime: Date,
  attendeeEmails: string[]
) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("No Google account linked");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description: description || undefined,
      start: {
        dateTime: startTime.toISOString(),
      },
      end: {
        dateTime: endTime.toISOString(),
      },
      attendees: attendeeEmails.map((email) => ({ email })),
      reminders: {
        useDefault: true,
      },
    },
    sendUpdates: "all",
  });

  return event.data;
}
