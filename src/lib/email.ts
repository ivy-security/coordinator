import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || "");
}

const FROM_EMAIL = process.env.FROM_EMAIL || "meetings@yourdomain.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendInviteEmail(
  to: string,
  meetingTitle: string,
  creatorName: string,
  shareToken: string
) {
  const voteUrl = `${APP_URL}/vote/${shareToken}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${creatorName} invited you to vote on: ${meetingTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5F8727; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Coordinator</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi there,</p>
          <p><strong>${creatorName}</strong> has invited you to vote on meeting times for:</p>
          <h2 style="color: #5F8727;">${meetingTitle}</h2>
          <p>Please click the button below to select the times that work for you.</p>
          <a href="${voteUrl}" style="display: inline-block; background: #5F8727; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Vote Now
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
            Or copy this link: ${voteUrl}
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendCompletionEmail(
  to: string,
  meetingTitle: string,
  meetingId: string
) {
  const meetingUrl = `${APP_URL}/meetings/${meetingId}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `All required votes are in: ${meetingTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5F8727; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Coordinator</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Great news!</p>
          <p>All required participants have voted on <strong>${meetingTitle}</strong>.</p>
          <p>Review the results and finalize the meeting time.</p>
          <a href="${meetingUrl}" style="display: inline-block; background: #5F8727; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Review Votes
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendFinalizedEmail(
  to: string,
  meetingTitle: string,
  startTime: string,
  endTime: string
) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Meeting confirmed: ${meetingTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5F8727; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Coordinator</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>The meeting <strong>${meetingTitle}</strong> has been confirmed!</p>
          <p><strong>Start:</strong> ${startTime}</p>
          <p><strong>End:</strong> ${endTime}</p>
          <p>A calendar invite has been sent to all participants.</p>
        </div>
      </div>
    `,
  });
}
