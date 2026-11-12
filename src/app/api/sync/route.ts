import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

// In-memory fallback for local dev when BLOB_READ_WRITE_TOKEN is not present
const localMemoryStore = new Map<string, { state: any; updatedAt: string }>();

function sanitizeKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawKey = searchParams.get("key");
    if (!rawKey) {
      return NextResponse.json({ error: "Параметр 'key' обязателен" }, { status: 400 });
    }

    const key = sanitizeKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Недопустимый ключ синхронизации" }, { status: 400 });
    }

    // Check if Vercel Blob is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const memoryItem = localMemoryStore.get(key);
      if (memoryItem) {
        return NextResponse.json({
          found: true,
          state: memoryItem.state,
          updatedAt: memoryItem.updatedAt,
          source: "memory",
        });
      }
      return NextResponse.json({ found: false, source: "memory" });
    }

    // List blobs with prefix
    const pathPrefix = `sync/${key}.json`;
    const { blobs } = await list({ prefix: pathPrefix, limit: 1 });

    if (!blobs || blobs.length === 0) {
      return NextResponse.json({ found: false });
    }

    const blob = blobs[0];
    const res = await fetch(blob.url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!res.ok) {
      return NextResponse.json({ found: false });
    }

    const stateData = await res.json();
    return NextResponse.json({
      found: true,
      state: stateData,
      updatedAt: blob.uploadedAt.toISOString(),
      url: blob.url,
    });
  } catch (err: any) {
    console.error("Sync GET error:", err);
    return NextResponse.json(
      { error: err.message || "Ошибка при получении данных синхронизации" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawKey = body?.key;
    const state = body?.state;

    if (!rawKey || !state) {
      return NextResponse.json(
        { error: "Поля 'key' и 'state' обязательны" },
        { status: 400 }
      );
    }

    const key = sanitizeKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Недопустимый ключ синхронизации" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // Check if Vercel Blob is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      localMemoryStore.set(key, { state, updatedAt: nowIso });
      return NextResponse.json({
        success: true,
        updatedAt: nowIso,
        source: "memory",
      });
    }

    const path = `sync/${key}.json`;
    const blob = await put(path, JSON.stringify(state), {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      updatedAt: nowIso,
      url: blob.url,
    });
  } catch (err: any) {
    console.error("Sync POST error:", err);
    return NextResponse.json(
      { error: err.message || "Ошибка при сохранении данных синхронизации" },
      { status: 500 }
    );
  }
}
