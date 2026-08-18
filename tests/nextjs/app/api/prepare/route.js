import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function POST(request) {
  const form = await request.formData();
  const mockPath = join(process.cwd(), "data", "transcoder-response.json");
  const mock = JSON.parse(await readFile(mockPath, "utf8"));

  return Response.json({
    ...mock,
    mock: true,
    received: {
      hasDescription: Boolean(form.get("description")),
      hasVideo: form.get("video") instanceof File
    }
  });
}
