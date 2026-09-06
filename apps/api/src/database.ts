import { MongoClient } from "mongodb";
import { readConfig } from "./config.js";

let connection: Promise<MongoClient> | undefined;
export async function database() {
  const config = readConfig();
  if (!connection) {
    const client = new MongoClient(config.mongoUri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });
    connection = client.connect().then(async () => {
      const db = client.db(config.dbName);
      await db.collection("users").createIndex({ clerkId: 1 }, { unique: true });
      await db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      return client;
    }).catch(async error => {
      connection = undefined;
      await client.close();
      throw error;
    });
  }
  return (await connection).db(config.dbName);
}

