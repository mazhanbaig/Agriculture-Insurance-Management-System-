import { Job } from "bullmq";
import { prisma } from "../lib/prisma";
import nodemailer from "nodemailer";
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

// Create reusable Nodemailer transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

/**
 * Process a notification job.
 * Creates a notification row in the database and sends an email via Nodemailer.
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

    // Send email notification via Nodemailer
    try {
      const transporter = createTransporter();
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.email) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"AIMS" <noreply@aims.app>',
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
