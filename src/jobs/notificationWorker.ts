import { Job } from "bullmq";
import { prisma } from "../lib/prisma";
import pino from "pino";

const logger = pino({ name: "notification-worker" });

interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Process a notification job.
 * Creates a notification row in the database and sends an email via Resend.
 */
export async function processNotificationJob(
  job: Job<NotificationJobData>
): Promise<void> {
  const { userId, type, title, message, relatedEntityType, relatedEntityId } =
    job.data;

  logger.info({ userId, type, title }, "Processing notification job");

  try {
    // Create notification in database
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId,
      },
    });

    // Send email notification via Resend
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY!);

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.email) {
        await resend.emails.send({
          from: "AIMS <notifications@aims.app>",
          to: user.email,
          subject: title,
          text: message,
        });
        logger.info({ userId, email: user.email }, "Email sent");
      }
    } catch (emailError) {
      // Log but don't fail the job if email fails
      logger.error({ error: emailError, userId }, "Failed to send email");
    }

    logger.info({ userId, type }, "Notification processed");
  } catch (error) {
    logger.error({ error, userId }, "Notification processing failed");
    throw error;
  }
}
