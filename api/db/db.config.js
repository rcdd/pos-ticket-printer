const requiredVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_PORT"];
const missing = requiredVars.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missing.join(", ")}`
  );
}

const port = Number(process.env.DB_PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("DB_PORT must be a positive integer.");
}

export default {
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  DB: process.env.DB_NAME,
  port,
  dialect: "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};
