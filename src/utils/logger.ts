import pino from "pino";

const logger = pino({
  name: "aims",
  level: process.env.LOG_LEVEL || "info",
});

export default logger;
