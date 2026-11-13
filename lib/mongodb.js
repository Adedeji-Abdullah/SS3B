import { MongoClient } from "mongodb";

const globalForMongo = globalThis;

function getMongoUri() {
  const uri = process.env.DATABASE_URL;
  if (!uri || !/^mongodb(\+srv)?:\/\//i.test(uri)) {
    throw new Error("DATABASE_URL must be a MongoDB connection string.");
  }

  const parsedUri = new URL(uri);
  if (!parsedUri.hostname || !parsedUri.pathname.replace(/^\/+|\/+$/g, "")) {
    throw new Error("DATABASE_URL must include a MongoDB database name.");
  }

  return uri;
}

export async function connectToDatabase() {
  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(getMongoUri());
    globalForMongo.mongoClient = client;
    globalForMongo.mongoClientPromise = client.connect().catch((error) => {
      globalForMongo.mongoClient = undefined;
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }

  const client = await globalForMongo.mongoClientPromise;
  const db = client.db();

  if (!globalForMongo.mongoIndexesPromise) {
    globalForMongo.mongoIndexesPromise = Promise.all([
      db.collection("students").createIndex({ normalizedName: 1 }, { unique: true }),
      db.collection("votes").createIndex({ studentId: 1 }, { unique: true }),
    ]).catch((error) => {
      globalForMongo.mongoIndexesPromise = undefined;
      throw error;
    });
  }

  await globalForMongo.mongoIndexesPromise;
  return db;
}
