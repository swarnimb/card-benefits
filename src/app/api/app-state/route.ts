import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const states = await prisma.appState.findMany();

  const flags: Record<string, string> = {};
  for (const state of states) {
    flags[state.key] = state.value;
  }

  return NextResponse.json(flags);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object of key-value pairs" },
      { status: 400 }
    );
  }

  const entries = Object.entries(body) as [string, string][];

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "At least one key-value pair is required" },
      { status: 400 }
    );
  }

  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      return NextResponse.json(
        { error: `Value for "${key}" must be a string` },
        { status: 400 }
      );
    }

    await prisma.appState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Return updated state
  const states = await prisma.appState.findMany();
  const flags: Record<string, string> = {};
  for (const state of states) {
    flags[state.key] = state.value;
  }

  return NextResponse.json(flags);
}
