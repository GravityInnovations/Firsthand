export async function POST(request) {
  const form = await request.formData();
  const prepared = form.get("prepared");

  if (!prepared) {
    return Response.json({ error: "Prepare the report before submitting." }, { status: 422 });
  }

  return Response.json({
    id: `next-${Date.now()}`,
    status: "received",
    prepared: JSON.parse(prepared),
    message: "The Next.js mock endpoint received the report. Nothing was uploaded externally."
  }, { status: 201 });
}
