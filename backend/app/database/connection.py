from pymongo import MongoClient
from pymongo.errors import PyMongoError
from app.core.config import settings

client: MongoClient | None = None


def connect():
    global client
    try:
        client = MongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            tz_aware=True,
        )
        client.admin.command("ping")
        print("MongoDB connected")
    except PyMongoError as e:
        print(f"MongoDB connection FAILED: {type(e).__name__}: {str(e)[:300]}")
        raise


def get_db():
    if client is None:
        raise RuntimeError("Database not connected")
    return client[settings.DATABASE_NAME]


def close():
    if client:
        client.close()


def is_healthy() -> bool:
    try:
        client.admin.command("ping")
        return True
    except (PyMongoError, AttributeError):
        return False