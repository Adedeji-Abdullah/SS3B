import { MongoClient } from "mongodb";

const uri = process.env.DATABASE_URL;
if (!uri || !/^mongodb(\+srv)?:\/\//i.test(uri)) {
  throw new Error("DATABASE_URL must be a MongoDB connection string.");
}

const parsedUri = new URL(uri);
if (!parsedUri.hostname || !parsedUri.pathname.replace(/^\/+|\/+$/g, "")) {
  throw new Error("DATABASE_URL must include a MongoDB database name.");
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();
  await Promise.all([
    db.collection("students").createIndex({ normalizedName: 1 }, { unique: true }),
    db.collection("votes").createIndex({ studentId: 1 }, { unique: true }),
  ]);
  console.log("MongoDB is connected and required unique indexes are ready.");
} finally {
  await client.close();
}
